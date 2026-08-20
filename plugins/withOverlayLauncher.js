const {
  withDangerousMod,
  withMainApplication,
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// --- Native source templates -------------------------------------------------
// __PACKAGE__ is replaced with the app's Android package (e.g. com.tentry.alarmapp).

const MODULE_KT = `package __PACKAGE__

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Overlay launch + permission probes used by onboarding auto-check.
 */
class OverlayLauncherModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "OverlayLauncher"

  @ReactMethod
  fun launchApp(promise: Promise) {
    try {
      val context = reactApplicationContext

      if (!Settings.canDrawOverlays(context)) {
        promise.resolve(false)
        return
      }

      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launchIntent == null) {
        promise.resolve(false)
        return
      }

      launchIntent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
      launchIntent.putExtra("tentry_alarm_launch", true)
      context.startActivity(launchIntent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OVERLAY_LAUNCH_FAILED", e)
    }
  }

  @ReactMethod
  fun canDrawOverlays(promise: Promise) {
    try {
      val granted = Settings.canDrawOverlays(reactApplicationContext)
      promise.resolve(granted)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** True when user granted ACCESS_NOTIFICATION_POLICY (DND access). */
  @ReactMethod
  fun isNotificationPolicyAccessGranted(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < 23) {
        promise.resolve(true)
        return
      }
      val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      promise.resolve(nm.isNotificationPolicyAccessGranted)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** True when this package is ignoring battery optimizations. */
  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < 23) {
        promise.resolve(true)
        return
      }
      val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      val pkg = reactApplicationContext.packageName
      promise.resolve(pm.isIgnoringBatteryOptimizations(pkg))
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * Full-screen intent allowed?
   * API 34+: NotificationManager.canUseFullScreenIntent()
   * Older: treat as granted (no separate switch).
   */
  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < 34) {
        promise.resolve(true)
        return
      }
      val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      promise.resolve(nm.canUseFullScreenIntent())
    } catch (e: Exception) {
      promise.resolve(true)
    }
  }
}
`;

const PACKAGE_KT = `package __PACKAGE__

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OverlayLauncherPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(OverlayLauncherModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function withOverlayLauncherFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = config.android.package;
      const pkgPath = pkg.split('.').join('/');
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        pkgPath
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'OverlayLauncherModule.kt'),
        MODULE_KT.split('__PACKAGE__').join(pkg)
      );
      fs.writeFileSync(
        path.join(dir, 'OverlayLauncherPackage.kt'),
        PACKAGE_KT.split('__PACKAGE__').join(pkg)
      );
      return config;
    },
  ]);
}

function withOverlayLauncherRegister(config) {
  return withMainApplication(config, (config) => {
    const pkg = config.android.package;
    const contents = config.modResults.contents;

    if (contents.includes('OverlayLauncherPackage()')) {
      return config; // already injected (re-running prebuild)
    }

    const anchor = 'val packages = PackageList(this).packages';
    if (contents.includes(anchor)) {
      config.modResults.contents = contents.replace(
        anchor,
        `${anchor}\n            packages.add(${pkg}.OverlayLauncherPackage())`
      );
    } else {
      console.warn(
        '[withOverlayLauncher] Could not find the expected PackageList anchor in ' +
          'MainApplication.kt. The native files were still written, but you will ' +
          'need to manually add `packages.add(' +
          pkg +
          '.OverlayLauncherPackage())` inside getPackages() for the JS bridge to see it.'
      );
    }
    return config;
  });
}

/**
 * Ensures notifee's ForegroundService is declared with mediaPlayback type.
 * Required on Android 14+ — without it, startForeground() can fail silently
 * and the keep-alive notification never appears.
 */
function withNotifeeForegroundService(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    if (!application.service) application.service = [];

    const SERVICE_NAME = 'app.notifee.core.ForegroundService';
    let service = application.service.find(
      (s) => s.$?.['android:name'] === SERVICE_NAME
    );

    if (!service) {
      service = {
        $: {
          'android:name': SERVICE_NAME,
          'android:foregroundServiceType': 'mediaPlayback',
          'tools:replace': 'android:foregroundServiceType',
        },
      };
      application.service.push(service);
    } else {
      service.$ = service.$ || {};
      service.$['android:foregroundServiceType'] = 'mediaPlayback';
      service.$['tools:replace'] = 'android:foregroundServiceType';
    }

    // Ensure tools namespace exists on the <manifest> root
    if (!manifest.manifest.$) manifest.manifest.$ = {};
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
}

module.exports = function withOverlayLauncher(config) {
  config = withOverlayLauncherFiles(config);
  config = withOverlayLauncherRegister(config);
  config = withNotifeeForegroundService(config);
  return config;
};
