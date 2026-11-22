# Nectarlink Services Root Module

Systemless root module for **Magisk**, **KernelSU** (including KernelSU Next / SukiSU), and **APatch / FolkPatch** to run **Nectarlink Services** (`sn.nectarlink.services`) as a privileged system app without Wireless Debugging, USB ADB, Shizuku, or `su` shell helpers.

## Module Structure

```text
nectarlink-module/
├── META-INF/com/google/android/
│   ├── update-binary
│   └── updater-script
├── system/
│   ├── product/
│   │   ├── app/Nectarlink/Nectarlink.apk                          (placeholder, optional)
│   │   └── etc/
│   │       ├── default-permissions/default-permissions-app.nectarlink.xml
│   │       └── sysconfig/sysconfig-app.nectarlink.xml
│   └── system_ext/
│       ├── priv-app/NectarlinkServices/NectarlinkServices.apk     (placeholder, required)
│       └── etc/
│           ├── permissions/privapp-permissions-sn.nectarlink.services.xml
│           ├── default-permissions/default-permissions-sn.nectarlink.services.xml
│           └── sysconfig/sysconfig-sn.nectarlink.services.xml
├── action.sh
├── customize.sh
├── module.prop
├── sepolicy.rule
├── service.sh
└── uninstall.sh
```

## Before Zipping & Flashing

1. Replace `system/system_ext/priv-app/NectarlinkServices/NectarlinkServices.apk` with your compiled `NectarlinkServices` APK (**required** — `customize.sh` aborts if it is still a placeholder).
2. *(Optional)* Replace `system/product/app/Nectarlink/Nectarlink.apk` with an official `thtbee/nectarlink` APK (`stable`, `nightly`, or `canary` release — GitHub Actions CI can bundle `nightly-and-stable` or any selected channel automatically). If left as a placeholder, `customize.sh` skips preinstalling the user app so you can install/update `Nectarlink` normally from `thtbee/nectarlink` GitHub Releases.
3. Zip the **contents** of `nectarlink-module/` (so `module.prop` is at the root of the `.zip`, not inside a subfolder) and flash in **Magisk**, **KernelSU**, or **APatch / FolkPatch**.

## Notes

- On Android 8–10 devices without `/system_ext` or `/product`, `customize.sh` automatically relocates files into `/system/priv-app`, `/system/app`, and `/system/etc`.
- `sepolicy.rule` grants `priv_app` access to `/dev/uhid` for hardware virtual gamepad and mouse support across Magisk, KernelSU, and APatch/FolkPatch.
- `service.sh` and `action.sh` apply Doze (`deviceidle`) exemptions and app-op grants (`MANAGE_ONGOING_CALLS`, `RECEIVE_SENSITIVE_NOTIFICATIONS`, `GET_USAGE_STATS`, `WRITE_SETTINGS`, DND) for `app.nectarlink` / `app.nectarlink.dev`.
- If your `Nectarlink` APK uses a different signing certificate than `config.xml` (`trusted_client_cert_sha256`), tap the module's **Action** button (or open **Nectarlink Services** settings) to approve it once.
- `.github/workflows/build.yml` checks `thtbee/nectarlink` releases every 30 minutes (`schedule`) and also accepts `repository_dispatch` (`nectarlink-canary`, `nectarlink-nightly`, `nectarlink-release`) to rebuild and update the module pre-release automatically when upstream publishes a new Canary, Nightly, or Stable APK.
