#!/system/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later

MODDIR="${0%/*}"

until [ "$(getprop sys.boot_completed)" = "1" ]; do
  sleep 2
done

# Wait briefly for user 0 CE storage so broadcast receivers can persist settings on FBE devices.
TRIES=0
while [ "$TRIES" -lt 30 ]; do
  if [ "$(getprop sys.user.0.ce_available)" = "true" ] || [ -d /data/media/0/Android ]; then
    break
  fi
  TRIES=$((TRIES + 1))
  sleep 1
done

dumpsys deviceidle whitelist +sn.nectarlink.services >/dev/null 2>&1
appops set sn.nectarlink.services WRITE_SETTINGS allow >/dev/null 2>&1

for PKG in app.nectarlink app.nectarlink.dev; do
  if pm path "$PKG" >/dev/null 2>&1; then
    dumpsys deviceidle whitelist +"$PKG" >/dev/null 2>&1
    appops set "$PKG" MANAGE_ONGOING_CALLS allow >/dev/null 2>&1
    appops set "$PKG" RECEIVE_SENSITIVE_NOTIFICATIONS allow >/dev/null 2>&1
    appops set "$PKG" GET_USAGE_STATS allow >/dev/null 2>&1
    appops set "$PKG" WRITE_SETTINGS allow >/dev/null 2>&1
    cmd notification allow_dnd "$PKG" >/dev/null 2>&1
  fi
done

run_shell_cmd() {
  if su -g 2000 -G 1004,1007,1011,1015,1028,1078,1079,3001,3002,3003,3006,3009,3011,3012 2000 -c "id -u" >/dev/null 2>&1; then
    su -g 2000 -G 1004,1007,1011,1015,1028,1078,1079,3001,3002,3003,3006,3009,3011,3012 2000 -c "$1"
  else
    su 2000 -c "$1"
  fi
}

gen_token() {
  if [ -r /proc/sys/kernel/random/uuid ]; then
    tr -d '-' < /proc/sys/kernel/random/uuid
  else
    date +%s%N | sha256sum | cut -c1-32
  fi
}

start_shell_bridge() {
  SVC_APK="$(pm path sn.nectarlink.services 2>/dev/null | head -n 1 | sed 's/^package://')"
  [ -z "$SVC_APK" ] && return 1
  TOKEN="$(gen_token)"
  [ -z "$TOKEN" ] && return 1

  OUT="/data/local/tmp/nl_shell_$$.out"
  rm -f "$OUT"
  run_shell_cmd "CLASSPATH='$SVC_APK' app_process /system/bin app.nectarlink.services.shell.ShellBridgeServer '$TOKEN'" >"$OUT" 2>/dev/null &
  WORKER_PID=$!

  PORT=""
  WAIT_TRIES=0
  while [ "$WAIT_TRIES" -lt 50 ]; do
    if [ -s "$OUT" ]; then
      LINE="$(head -n 1 "$OUT" 2>/dev/null)"
      case "$LINE" in
        "ready "*)
          PORT="${LINE#ready }"
          break
          ;;
      esac
    fi
    kill -0 "$WORKER_PID" >/dev/null 2>&1 || break
    WAIT_TRIES=$((WAIT_TRIES + 1))
    sleep 1
  done
  rm -f "$OUT"

  if [ -z "$PORT" ]; then
    log -t NectarlinkShell "ShellBridgeServer failed to announce ready port" 2>/dev/null
    kill "$WORKER_PID" >/dev/null 2>&1
    wait "$WORKER_PID" >/dev/null 2>&1
    return 1
  fi

  log -t NectarlinkShell "ShellBridgeServer ready on loopback port $PORT" 2>/dev/null

  broadcast_ready() {
    am broadcast --user 0 -f 0x10000000 \
      -p sn.nectarlink.services \
      -a sn.nectarlink.services.ACTION_SHELL_READY \
      --ei shell_port "$PORT" \
      --es shell_token "$TOKEN" >/dev/null 2>&1
    am broadcast --user 0 -f 0x10000000 \
      -n sn.nectarlink.services/app.nectarlink.services.service.ShellBridgeReceiver \
      -a sn.nectarlink.services.ACTION_SHELL_READY \
      --ei shell_port "$PORT" \
      --es shell_token "$TOKEN" >/dev/null 2>&1
  }

  broadcast_ready
  (
    for DELAY in 2 4 9 15; do
      sleep "$DELAY"
      kill -0 "$WORKER_PID" >/dev/null 2>&1 || exit 0
      broadcast_ready
    done
  ) &

  wait "$WORKER_PID" >/dev/null 2>&1
  return 0
}

(
  while [ -d "$MODDIR" ] && [ ! -f "$MODDIR/disable" ] && [ ! -f "$MODDIR/remove" ]; do
    start_shell_bridge
    sleep 3
  done
) &
