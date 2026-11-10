import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing: ~/.config/salsa/key.properties (outside the repo) points at
// the keystore. Every build is signed with it, debug included, so an update
// installs over any earlier build. Without it, debug builds keep the debug key
// and a release build fails rather than signing with the wrong one.
val keyFile = File(System.getProperty("user.home"), ".config/salsa/key.properties")
val keyProperties = Properties().apply {
    if (keyFile.exists()) keyFile.inputStream().use { load(it) }
}
val hasKey = keyProperties.containsKey("storeFile")

gradle.taskGraph.whenReady {
    val release = allTasks.any {
        it.project == project && Regex("^(assemble|package|bundle).*Release$").matches(it.name)
    }
    if (release && !hasKey) {
        throw GradleException(
            "Release signing: ${keyFile.path} (storeFile, storePassword, keyAlias, keyPassword) " +
                "is missing. See docs/deployment.md.",
        )
    }
}

android {
    // PACKAGE in src/routes/.well-known/assetlinks.json/+server.ts names it (unused since the WebView).
    namespace = "eu.anotherroot.salsa"
    compileSdk = 36

    defaultConfig {
        minSdk = 29
        targetSdk = 36
        versionCode = 12
        versionName = "1.11"
    }

    signingConfigs {
        if (hasKey) {
            create("release") {
                storeFile = File(keyProperties.getProperty("storeFile"))
                storePassword = keyProperties.getProperty("storePassword")
                keyAlias = keyProperties.getProperty("keyAlias")
                keyPassword = keyProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            if (hasKey) signingConfig = signingConfigs.getByName("release")
        }
        getByName("release") {
            if (hasKey) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }

    // The site each app shows and talks to: scheme and host, no path or trailing
    // slash. Each dance has its own host (the dance split). Override both with
    // -Psite=https://… (plain http is refused: the app allows no cleartext traffic).
    fun site(default: String) = (project.findProperty("site") ?: default).toString()

    /*
     * One app per dance, from one codebase: each its own package, name, icon,
     * launcher and share-sheet entry, and so its own login, pairing, upload
     * queue and notifications. Salsa keeps the original id, so the app
     * already installed becomes it. A second dimension, the channel (direct: installed from the site, updates itself; play: the Play Store). Four APKs, e.g.
     * app-salsa-direct-debug.apk.
     */
    flavorDimensions += listOf("dance", "channel")
    productFlavors {
        create("salsa") {
            dimension = "dance"
            applicationId = "eu.anotherroot.salsa"
            buildConfigField("String", "DANCE", "\"salsa\"")
            buildConfigField("String", "SITE", "\"${site("https://salsa.anotherroot.eu")}\"")
            resValue("string", "app_name", "Salsa")
            resValue("string", "share_label", "Salsa lesson")
            manifestPlaceholders["appIcon"] = "@mipmap/ic_salsa"
            manifestPlaceholders["launcher"] = ".SalsaLauncher"
        }
        create("bachata") {
            dimension = "dance"
            applicationId = "eu.anotherroot.bachata"
            buildConfigField("String", "DANCE", "\"bachata\"")
            buildConfigField("String", "SITE", "\"${site("https://bachata.anotherroot.eu")}\"")
            resValue("string", "app_name", "Bachata")
            resValue("string", "share_label", "Bachata lesson")
            manifestPlaceholders["appIcon"] = "@mipmap/ic_bachata"
            manifestPlaceholders["launcher"] = ".BachataLauncher"
        }
        create("direct") {
            dimension = "channel"
            buildConfigField("String", "CHANNEL", "\"direct\"")
        }
        create("play") {
            dimension = "channel"
            buildConfigField("String", "CHANNEL", "\"play\"")
        }
    }

    buildFeatures {
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    // The page's wake lock and speech bridges (WebShell): document-start scripts and message listeners.
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("androidx.media3:media3-transformer:1.11.1")
    implementation("androidx.media3:media3-effect:1.11.1")
    implementation("androidx.media3:media3-common:1.11.1")
    // Android ships org.json; plain JVM tests need a real copy of it.
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
