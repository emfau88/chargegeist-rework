package com.energycrafted.chargegeist;

import android.content.Context;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Keeps what the widget on the home screen shows (see src/platform/widget.ts): the widget cannot read
 * the save inside the WebView, so the app hands it a copy of a few values and a portrait of the
 * companion. Only kept here; nothing in the app ever reads it back.
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    static final String PREFS = "chargegeist_widget";
    /** The values as JSON (WidgetData in src/logic/widget.ts). */
    static final String DATA = "data";
    /** The portrait, below the app's own files. */
    static final String PORTRAIT = "widget/ghost.png";

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
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(DATA, data).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("widget update failed", e);
        }
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
