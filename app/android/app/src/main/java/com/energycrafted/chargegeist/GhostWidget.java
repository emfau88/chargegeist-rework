package com.energycrafted.chargegeist;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.io.File;
import org.json.JSONObject;

/**
 * The widget on the home screen: the companion, today's charge against the goal, and a button that
 * starts a session; while one runs, when it ends. It draws only what the app left for it (WidgetPlugin,
 * src/logic/widget.ts) and never touches the save. Whatever goes wrong here, it keeps showing what it
 * showed before.
 *
 * No countdown: a clock in a widget runs on below zero until someone draws it again, and Android may
 * wake a widget late. The end of a session as a time of day stays right without being drawn again.
 */
public class GhostWidget extends AppWidgetProvider {

    /** From this width on (dp) the companion stands beside the charge instead of above it. */
    private static final int WIDE_DP = 220;
    /** The portrait is never larger than this: a widget may carry only so many pixels. */
    private static final int MAX_PX = 300;

    /** The moment a session ends or the day turns: draw again, the app may be closed by then. */
    private static final String TICK = "com.energycrafted.chargegeist.WIDGET_TICK";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (TICK.equals(intent.getAction())) refresh(ctx);
        else super.onReceive(ctx, intent);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] ids) {
        for (int id : ids) draw(ctx, manager, id);
        schedule(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager manager, int id, Bundle options) {
        draw(ctx, manager, id);
    }

    @Override
    public void onDisabled(Context ctx) {
        schedule(ctx);
    }

    /** Draws every widget anew: the app has left new values, or a session ended, or the day turned. */
    static void refresh(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        for (int id : manager.getAppWidgetIds(new ComponentName(ctx, GhostWidget.class))) draw(ctx, manager, id);
        schedule(ctx);
    }

    /**
     * One soft alarm for the next moment the widget changes by itself: the end of the running session or
     * the end of the day. No exact alarm and no waking the phone: Android may hold it back a few minutes,
     * and a screen that is off shows nothing anyway. No widget, nothing coming: no alarm.
     */
    private static void schedule(Context ctx) {
        try {
            AlarmManager alarms = ctx.getSystemService(AlarmManager.class);
            Intent tick = new Intent(ctx, GhostWidget.class).setAction(TICK);
            PendingIntent pending = PendingIntent.getBroadcast(ctx, 0, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            long now = System.currentTimeMillis();
            long next = Long.MAX_VALUE;
            JSONObject d = data(ctx);
            if (d != null) {
                long until = d.optLong("until", 0);
                if (until > now) next = until;
                JSONObject session = d.optJSONObject("session");
                if (session != null && !session.isNull("ends")) {
                    long ends = session.optLong("ends");
                    if (ends > now) next = Math.min(next, ends);
                }
            }
            if (next == Long.MAX_VALUE || !placed(ctx)) alarms.cancel(pending);
            else alarms.setWindow(AlarmManager.RTC, next + 1000, 60_000, pending);
        } catch (Exception e) {
            // then the next regular update draws it
        }
    }

    /** Whether at least one widget is on a home screen. */
    static boolean placed(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, GhostWidget.class)).length > 0;
    }

    private static void draw(Context ctx, AppWidgetManager manager, int id) {
        try {
            manager.updateAppWidget(id, build(ctx, manager.getAppWidgetOptions(id)));
        } catch (Exception e) {
            // it keeps what it showed
        }
    }

    private static RemoteViews build(Context ctx, Bundle options) {
        boolean wide = options != null && options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) >= WIDE_DP;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), wide ? R.layout.widget_ghost_wide : R.layout.widget_ghost);

        // as a picture, never as a file: the home screen may not read the files of the app
        Bitmap ghost = portrait(ctx);
        if (ghost != null) v.setImageViewBitmap(R.id.widget_ghost, ghost);

        JSONObject d = data(ctx);
        if (d != null) {
            JSONObject text = d.optJSONObject("text");
            if (text == null) text = new JSONObject();
            long now = System.currentTimeMillis();
            boolean today = now < d.optLong("until", 0);
            int goal = Math.max(1, d.optInt("goal", 30));
            int minutes = today ? Math.max(0, d.optInt("today", 0)) : 0;
            v.setTextViewText(R.id.widget_today, text.optString(today ? "today" : "zero"));
            v.setProgressBar(R.id.widget_bar, goal, Math.min(minutes, goal), false);
            String name = d.optString("name");
            if (!name.isEmpty()) v.setContentDescription(R.id.widget_ghost, name);

            JSONObject session = d.optJSONObject("session");
            if (session != null) {
                String status;
                if (session.isNull("ends")) status = text.optString("paused");
                else if (now >= session.optLong("ends")) status = text.optString("done");
                else status = text.optString("ends");
                v.setTextViewText(R.id.widget_status, status);
                v.setViewVisibility(R.id.widget_status, View.VISIBLE);
                v.setViewVisibility(R.id.widget_start, View.GONE);
            } else {
                v.setTextViewText(R.id.widget_start, text.optString("start", ctx.getString(R.string.widget_start)));
                v.setContentDescription(R.id.widget_start, text.optString("startHint"));
                v.setViewVisibility(R.id.widget_status, View.GONE);
                v.setViewVisibility(R.id.widget_start, View.VISIBLE);
            }
        }
        v.setOnClickPendingIntent(android.R.id.background, open(ctx, false));
        v.setOnClickPendingIntent(R.id.widget_start, open(ctx, true));
        return v;
    }

    /** Opens the app; start: and starts a session there (see WidgetPlugin.noteStart). */
    private static PendingIntent open(Context ctx, boolean start) {
        Intent intent = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (start) intent.putExtra(WidgetPlugin.EXTRA_START, true);
        // two request codes: two different taps, not one intent overwriting the other
        return PendingIntent.getActivity(ctx, start ? 1 : 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static JSONObject data(Context ctx) {
        try {
            String raw = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE).getString(WidgetPlugin.DATA, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap portrait(Context ctx) {
        try {
            File file = new File(ctx.getFilesDir(), WidgetPlugin.PORTRAIT);
            if (!file.isFile()) return null;
            Bitmap b = BitmapFactory.decodeFile(file.getPath());
            if (b == null) return null;
            int side = Math.max(b.getWidth(), b.getHeight());
            if (side <= MAX_PX) return b;
            float k = (float) MAX_PX / side;
            return Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true);
        } catch (Exception e) {
            return null;
        }
    }
}
