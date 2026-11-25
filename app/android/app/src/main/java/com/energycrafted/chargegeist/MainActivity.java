package com.energycrafted.chargegeist;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Android is rebuilding the app after it closed it: the intent it brings is an old one. */
    private boolean restored;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BillingPlugin.class);
        registerPlugin(WidgetPlugin.class);
        restored = savedInstanceState != null;
        super.onCreate(savedInstanceState);
        restored = false;
    }

    /** Also runs at the start, with the intent that opened the app (BridgeActivity.load). */
    @Override
    protected void onNewIntent(Intent intent) {
        if (!restored) WidgetPlugin.noteStart(intent);
        super.onNewIntent(intent);
    }
}
