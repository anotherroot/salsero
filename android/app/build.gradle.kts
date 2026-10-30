plugins {
    id("com.android.application")
}

android {
    // PACKAGE in src/routes/.well-known/assetlinks.json/+server.ts names it (unused since the WebView).
    namespace = "eu.anotherroot.salsa"
    compileSdk = 36

    defaultConfig {
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        // The site the app shows and talks to: scheme and host, no path or
        // trailing slash. Override with -Psite=https://… (plain http is
        // refused: the app allows no cleartext traffic).
        val site = (project.findProperty("site") ?: "https://salsa.anotherroot.eu").toString()
        buildConfigField("String", "SITE", "\"$site\"")
    }

    /*
     * One app per dance, from one codebase: each its own package, name, icon,
     * launcher and share-sheet entry, and so its own login, pairing, upload
     * queue and notifications. Salsa keeps the original id, so the app
     * already installed becomes it. Two APKs: app-salsa-debug.apk and
     * app-bachata-debug.apk.
     */
    flavorDimensions += "dance"
    productFlavors {
        create("salsa") {
            dimension = "dance"
            applicationId = "eu.anotherroot.salsa"
            buildConfigField("String", "DANCE", "\"salsa\"")
            resValue("string", "app_name", "Salsa")
            resValue("string", "share_label", "Salsa lesson")
            manifestPlaceholders["appIcon"] = "@mipmap/ic_salsa"
            manifestPlaceholders["launcher"] = ".SalsaLauncher"
        }
        create("bachata") {
            dimension = "dance"
            applicationId = "eu.anotherroot.bachata"
            buildConfigField("String", "DANCE", "\"bachata\"")
            resValue("string", "app_name", "Bachata")
            resValue("string", "share_label", "Bachata lesson")
            manifestPlaceholders["appIcon"] = "@mipmap/ic_bachata"
            manifestPlaceholders["launcher"] = ".BachataLauncher"
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
