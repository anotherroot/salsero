plugins {
    id("com.android.application")
}

android {
    // Must match PACKAGE in src/routes/.well-known/assetlinks.json/+server.ts.
    namespace = "eu.anotherroot.salsa"
    compileSdk = 36

    defaultConfig {
        applicationId = "eu.anotherroot.salsa"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        // The site the app wraps and talks to. Override for a dev server with
        // -Psite=http://10.0.2.2:5173 (the TWA needs https; the API does not).
        val site = (project.findProperty("site") ?: "https://salsa.anotherroot.eu").toString()
        buildConfigField("String", "SITE", "\"$site\"")
        // Each launcher opens its dance marked as the app, so pages offer native links.
        resValue("string", "salsa_url", "$site/salsa?app=android")
        resValue("string", "bachata_url", "$site/bachata?app=android")
        resValue(
            "string", "asset_statements",
            """[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"$site"}}]""",
        )
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
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
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
