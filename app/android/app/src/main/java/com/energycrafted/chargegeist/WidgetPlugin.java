package com.energycrafted.chargegeist;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Between the app and its widget on the home screen (GhostWidget, src/platform/widget.ts).
 *
 * update: the widget cannot read the save inside the WebView, so the app hands it a copy of a few values
 * and a portrait of the companion. They are only kept here; nothing in the app ever reads them back.
 * placed and pin: whether a widget is on a home screen, and the request of Android to put one there.
 * takeStart: the start button of the widget, handed over once (see noteStart).
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    static final String PREFS = "chargegeist_widget";
    /** The values as JSON (WidgetData in src/logic/widget.ts). */
    static final String DATA = "data";
    /** The portrait, below the app's own files. */
    static final String PORTRAIT = "widget/ghost.png";
    /** On the intent of the widget's start button. */
    static final String EXTRA_START = "com.energycrafted.chargegeist.WIDGET_START";
    /** A tap on the start button older than this is not acted on any more. */
    private static final long START_FRESH_MS = 60_000;

    /** When the start button was tapped (elapsed realtime), 0: not since it was last handed over. */
    private static volatile long startAt = 0;

    /**
     * Notes a tap on the widget's start button, once. Not when the intent comes back with the app out of
     * the list of recent apps, nor when Android rebuilds the app after it was closed (MainActivity):
     * then it is the old tap, and a session would start that nobody asked for.
     */
    static void noteStart(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_START, false)) return;
        intent.removeExtra(EXTRA_START);
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return;
        startAt = SystemClock.elapsedRealtime();
    }

    /** data: the values as JSON. portrait: a PNG in base64, sent only when the companion changed. */
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("no data");
            return;
        }
        String portrait = call.getString("portrait");
        try {
            if (portrait != null) writePortrait(Base64.decode(portrait, Base64.DEFAULT));
            // commit, not apply: the widget reads right after this
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(DATA, data).commit();
            GhostWidget.refresh(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("widget update failed", e);
        }
    }

    @PluginMethod
    public void placed(PluginCall call) {
        JSObject r = new JSObject();
        r.put("placed", GhostWidget.placed(getContext()));
        call.resolve(r);
    }

    /**
     * Asks Android to put the widget on the home screen; Android shows its own question. asked: whether
     * the question could be put. Whether the person said yes is not reported here, and on some phones
     * (Xiaomi) a refused permission swallows the question without a word: placed tells later.
     */
    @PluginMethod
    public void pin(PluginCall call) {
        boolean asked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
                if (manager.isRequestPinAppWidgetSupported()) {
                    asked = manager.requestPinAppWidget(new ComponentName(getContext(), GhostWidget.class), null, null);
                }
            } catch (Exception e) {
                asked = false;
            }
        }
        JSObject r = new JSObject();
        r.put("asked", asked);
        call.resolve(r);
    }

    /** start: the start button was tapped just now. Answers true once per tap. */
    @PluginMethod
    public void takeStart(PluginCall call) {
        long at = startAt;
        startAt = 0;
        JSObject r = new JSObject();
        r.put("start", at != 0 && SystemClock.elapsedRealtime() - at < START_FRESH_MS);
        call.resolve(r);
    }

    /** Written next to the old one and then put in its place: a reader never meets half a picture. */
    private void writePortrait(byte[] png) throws IOException {
        File file = new File(getContext().getFilesDir(), PORTRAIT);
        File dir = file.getParentFile();
        if (dir == null || (!dir.isDirectory() && !dir.mkdirs())) throw new IOException("no folder for the portrait");
        File tmp = new File(dir, file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(png);
        }
        if (!tmp.renameTo(file)) throw new IOException("portrait not replaced");
    }
}
