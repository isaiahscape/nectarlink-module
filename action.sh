#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later

MODDIR="${0%/*}"

if [ "$KSU" = "true" ]; then
  echo "- Manager: KernelSU"
elif [ "$APATCH" = "true" ] || [ -d "/data/adb/ap" ] || [ -f "/data/adb/folkpatch" ]; then
  echo "- Manager: APatch / FolkPatch"
else
  echo "- Manager: Magisk"
fi

if pm path sn.nectarlink.services >/dev/null 2>&1; then
  echo "- Nectarlink Services: installed ($(pm path sn.nectarlink.services | head -n 1))"
else
  echo "! Nectarlink Services is not visible to PackageManager"
fi

for PKG in app.nectarlink app.nectarlink.dev; do
  if pm path "$PKG" >/dev/null 2>&1; then
    echo "- Client installed: $PKG"
    dumpsys deviceidle whitelist +"$PKG" >/dev/null 2>&1
    appops set "$PKG" MANAGE_ONGOING_CALLS allow >/dev/null 2>&1
    appops set "$PKG" RECEIVE_SENSITIVE_NOTIFICATIONS allow >/dev/null 2>&1
    appops set "$PKG" GET_USAGE_STATS allow >/dev/null 2>&1
    appops set "$PKG" WRITE_SETTINGS allow >/dev/null 2>&1
    cmd notification allow_dnd "$PKG" >/dev/null 2>&1
  fi
done

echo "- Opening Nectarlink Services settings..."
am start -a sn.nectarlink.services.ACTION_SETTINGS >/dev/null 2>&1 || \
  am start -n sn.nectarlink.services/app.nectarlink.services.ui.ServicesSettingsActivity >/dev/null 2>&1
