#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later

SKIPUNZIP=1

if [ "$KSU" = "true" ]; then
  ROOT_MGR="KernelSU"
elif [ "$APATCH" = "true" ] || [ -d "/data/adb/ap" ] || [ -f "/data/adb/folkpatch" ]; then
  ROOT_MGR="APatch/FolkPatch"
else
  ROOT_MGR="Magisk"
fi

ui_print "- Nectarlink Services ($ROOT_MGR)"
ui_print "- API level: $API"

if [ "$API" -lt 26 ]; then
  abort "! Android 8.0 (API 26) or newer is required"
fi

unzip -o "$ZIPFILE" -x 'META-INF/*' -d "$MODPATH" >&2

SVC_APK="$MODPATH/system/system_ext/priv-app/NectarlinkServices/NectarlinkServices.apk"
APP_APK="$MODPATH/system/product/app/Nectarlink/Nectarlink.apk"

if [ ! -s "$SVC_APK" ] || [ "$(wc -c < "$SVC_APK")" -lt 1024 ]; then
  abort "! NectarlinkServices.apk is still a placeholder. Replace system/system_ext/priv-app/NectarlinkServices/NectarlinkServices.apk before flashing."
fi

if [ ! -s "$APP_APK" ] || [ "$(wc -c < "$APP_APK")" -lt 1024 ]; then
  ui_print "- Nectarlink.apk placeholder detected; skipping user app preinstall"
  rm -rf "$MODPATH/system/product/app/Nectarlink"
fi

if [ ! -d "/system_ext/priv-app" ] && [ ! -d "/system/system_ext/priv-app" ]; then
  ui_print "- /system_ext not present; relocating NectarlinkServices to /system"
  mkdir -p "$MODPATH/system/priv-app" \
    "$MODPATH/system/etc/permissions" \
    "$MODPATH/system/etc/default-permissions" \
    "$MODPATH/system/etc/sysconfig"
  mv "$MODPATH/system/system_ext/priv-app/"* "$MODPATH/system/priv-app/" 2>/dev/null
  mv "$MODPATH/system/system_ext/etc/permissions/"* "$MODPATH/system/etc/permissions/" 2>/dev/null
  mv "$MODPATH/system/system_ext/etc/default-permissions/"* "$MODPATH/system/etc/default-permissions/" 2>/dev/null
  mv "$MODPATH/system/system_ext/etc/sysconfig/"* "$MODPATH/system/etc/sysconfig/" 2>/dev/null
  rm -rf "$MODPATH/system/system_ext"
fi

if [ ! -d "/product/app" ] && [ ! -d "/system/product/app" ]; then
  ui_print "- /product not present; relocating Nectarlink config to /system"
  mkdir -p "$MODPATH/system/app" \
    "$MODPATH/system/etc/default-permissions" \
    "$MODPATH/system/etc/sysconfig"
  if [ -d "$MODPATH/system/product/app/Nectarlink" ]; then
    mv "$MODPATH/system/product/app/"* "$MODPATH/system/app/" 2>/dev/null
  fi
  mv "$MODPATH/system/product/etc/default-permissions/"* "$MODPATH/system/etc/default-permissions/" 2>/dev/null
  mv "$MODPATH/system/product/etc/sysconfig/"* "$MODPATH/system/etc/sysconfig/" 2>/dev/null
  rm -rf "$MODPATH/system/product"
fi

set_perm_recursive "$MODPATH" 0 0 0755 0644
[ -f "$MODPATH/service.sh" ] && set_perm "$MODPATH/service.sh" 0 0 0755
[ -f "$MODPATH/action.sh" ] && set_perm "$MODPATH/action.sh" 0 0 0755
[ -f "$MODPATH/uninstall.sh" ] && set_perm "$MODPATH/uninstall.sh" 0 0 0755
