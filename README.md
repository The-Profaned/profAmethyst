# Titan Java Sample Plugin

Runnable sample plugin and starter project for TitanClient's Java SDK.

This repository demonstrates:

- `@PluginDescriptor` metadata.
- Guice injection with `@Inject`.
- RuneLite-style config interfaces.
- Event subscriptions through `@Subscribe`.
- Direct `Client` accessors such as `client.tick()` and `client.localPlayer()`.

## Use This As Your Plugin Starter

Copy or fork this repository for a new Java plugin. Then:

1. Rename the `net.titan.sample` package and classes.
2. Update `@PluginDescriptor` with your plugin ID, name, author, and version.
3. Update `SamplePluginConfig` or replace it with your own config interface.
4. Change the output JAR name in `build.gradle`.

## Requirements

- Java 11 or newer.
- TitanLauncher run at least once so `%USERPROFILE%\.titanclient\repository`
  points at a synced runtime with the embedded Java runtime.
- A TitanClient account with the `feature.debug_mode` entitlement.

The sample uses the published SDK dependency:

```gradle
repositories {
    maven { url = uri('https://raw.githubusercontent.com/Soxs/titan-public-sdk/main/maven/releases') }
    mavenCentral()
}

compileOnly 'net.titan:titan-plugin-api:latest.release'
```

The sample already points at the public Titan SDK Maven repository and defaults
to `latest.release`. Pass `-PtitanSdkVersion=latest` for the same behavior, or
pin an exact SDK version such as `-PtitanSdkVersion=0.1.3` for reproducible
plugin releases. Pass
`-PtitanMavenRepositoryUrl=...` or set `TITAN_MAVEN_REPOSITORY_URL` only when
testing another repository.

For local SDK work, publish from the SDK checkout first:

```powershell
cd path\to\titan-public-sdk\java
.\gradlew.bat publishToMavenLocal
```

This project checks Maven Local before remote repositories.

## Build

```powershell
.\gradlew.bat clean build
```

The plugin JAR is written to:

```text
build\libs\titan-sample-plugin.jar
```

## Run In TitanClient

The included `gradle.properties` defaults `titanClientRoot` to the
TitanLauncher sync repository:

```properties
titanClientRoot=%USERPROFILE%/.titanclient/repository
```

The Gradle dev plugin reads `state.json` from that repository and resolves the
current `releases/<version>` folder. That synced runtime must include the
embedded Java runtime at:

```text
java/titan-java-embedded.jar
```

Then run:

```powershell
.\gradlew.bat runViaTitan
```

`runTitanClient`/`runViaTitan` will also try the launcher repository, common
TitanClient install folders, and local source-build output folders if
`titanClientRoot` is left blank.

You can still use a one-off Gradle property:

```powershell
.\gradlew.bat runViaTitan "-PtitanClientRoot=%USERPROFILE%/.titanclient/repository"
```

Or set it for the current PowerShell session:

```powershell
$env:TITAN_CLIENT_ROOT = "%USERPROFILE%/.titanclient/repository"
.\gradlew.bat runViaTitan
```

For a local TitanClient source build, build `controller` first and use the
build output folder. Make sure Java runtime staging is enabled:

```powershell
cmake -S . -B build -DTITAN_BUILD_JAVA_RUNTIME=ON
cmake --build build --config Release --target controller
.\gradlew.bat runViaTitan "-PtitanClientRoot=C:\path\to\SoxClientOSRS\build\controller\Release"
```

`runViaTitan` is an alias for `runTitanClient`.

The task builds the sample, stages it into a per-generation dev folder, writes
`build/.titan/dev/<slug>/session.json`, and launches:

```text
controller.exe --dev-mode --dev-manifest <session.json> --launch-new-client
```

The dev tab name is derived automatically from the Gradle project name, so
there is no plugin-id value to keep in sync. TitanClient loads every
`@PluginDescriptor` found in the staged project JAR into that tab. Re-running
the Gradle task from IntelliJ recycles only that project's dev tab; other
Titan tabs keep running.

The staged layout is:

```text
build/.titan/dev/<slug>/
  session.json
  gen.txt
  session_id.txt
  load/gen-N/<plugin>.jar
```

If two projects on the same machine produce the same derived tab name, pass a
stable override with `-PtitanDevSessionSlug=...` or set
`TITAN_DEV_SESSION_SLUG`.

## Debug From IntelliJ

Run the debug launch task:

```powershell
.\gradlew.bat runViaTitanDebug
```

This writes `java_debug_port` into the dev manifest and starts the embedded JVM
with JDWP on port `5005`. In IntelliJ, create a **Remote JVM Debug** run
configuration for `localhost:5005` and attach after the Titan tab starts.

Use a different port when running more than one Java debug tab:

```powershell
.\gradlew.bat runViaTitanDebug "-PtitanJavaDebugPort=5006"
```

`TITAN_JAVA_DEBUG_PORT` is also supported. The old `stagePlugin` task still
copies the JAR to `%USERPROFILE%\.titanclient\plugins` for manual DEV scans,
and `TITAN_PLUGIN_DIR` / `-PtitanPluginDir=...` still override that legacy
staging directory.

## API Packages

- `net.titan.api` for `Client`, `Player`, and `Logger`.
- `net.titan.api.plugins` for `Plugin` and `PluginDescriptor`.
- `net.titan.api.config` for config annotations.
- `net.titan.api.events` and `net.titan.api.eventbus` for subscriptions.
