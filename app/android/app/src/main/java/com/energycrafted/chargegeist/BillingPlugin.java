package com.energycrafted.chargegeist;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.BillingResponseCode;
import com.android.billingclient.api.BillingClient.ProductType;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * One-time purchases through Google Play, as little as the app needs (see src/platform/billing.ts):
 * product: what a product costs here, owned: what this account has bought, buy: the purchase itself.
 * Every purchase is acknowledged here; Google refunds one that is not acknowledged within three days.
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    private PluginCall buying;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    /** Runs the task on the main thread once the store answers; rejects the call if it does not. */
    private void withStore(PluginCall call, Runnable task) {
        getActivity().runOnUiThread(() -> {
            if (client.isReady()) {
                task.run();
                return;
            }
            client.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult r) {
                    if (ok(r)) task.run();
                    else fail(call, r);
                }

                @Override
                public void onBillingServiceDisconnected() {}
            });
        });
    }

    private static boolean ok(BillingResult r) {
        return r.getResponseCode() == BillingResponseCode.OK;
    }

    private static void fail(PluginCall call, BillingResult r) {
        call.reject("store: " + r.getDebugMessage(), String.valueOf(r.getResponseCode()));
    }

    private interface Found {
        void product(ProductDetails details);
    }

    /** Looks the product up in the store. Null: the store does not sell it to this account. */
    private void find(PluginCall call, Found then) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(call.getString("id", ""))
            .setProductType(ProductType.INAPP)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(List.of(product)).build();
        client.queryProductDetailsAsync(params, (r, found) -> {
            if (!ok(r)) {
                fail(call, r);
                return;
            }
            List<ProductDetails> list = found.getProductDetailsList();
            then.product(list.isEmpty() ? null : list.get(0));
        });
    }

    private void acknowledge(Purchase p) {
        if (p.isAcknowledged()) return;
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> {});
    }

    @PluginMethod
    public void product(PluginCall call) {
        withStore(call, () -> find(call, details -> {
            JSObject out = new JSObject();
            ProductDetails.OneTimePurchaseOfferDetails offer = details == null ? null : details.getOneTimePurchaseOfferDetails();
            if (offer != null) out.put("price", offer.getFormattedPrice());
            call.resolve(out);
        }));
    }

    @PluginMethod
    public void owned(PluginCall call) {
        withStore(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build(), (r, purchases) -> {
            if (!ok(r)) {
                fail(call, r);
                return;
            }
            JSArray ids = new JSArray();
            for (Purchase p : purchases) {
                if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                acknowledge(p);
                for (String id : p.getProducts()) ids.put(id);
            }
            JSObject out = new JSObject();
            out.put("ids", ids);
            call.resolve(out);
        }));
    }

    @PluginMethod
    public void buy(PluginCall call) {
        withStore(call, () -> find(call, details -> {
            if (details == null) {
                call.reject("store: no such product", String.valueOf(BillingResponseCode.ITEM_UNAVAILABLE));
                return;
            }
            BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
            ProductDetails.OneTimePurchaseOfferDetails offer = details.getOneTimePurchaseOfferDetails();
            if (offer != null && offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) item.setOfferToken(offer.getOfferToken());
            buying = call;
            BillingResult r = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder().setProductDetailsParamsList(List.of(item.build())).build());
            if (!ok(r)) {
                buying = null;
                fail(call, r);
            }
        }));
    }

    /** The answer to a purchase. It can also come without a call: a payment that was pending has gone through. */
    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        PluginCall call = buying;
        buying = null;
        String state;
        int code = r.getResponseCode();
        if (code == BillingResponseCode.OK && purchases != null) {
            state = "pending";
            for (Purchase p : purchases) {
                if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                acknowledge(p);
                state = "bought";
            }
        } else if (code == BillingResponseCode.USER_CANCELED) {
            state = "cancelled";
        } else if (code == BillingResponseCode.ITEM_ALREADY_OWNED) {
            state = "bought";
        } else {
            if (call != null) fail(call, r);
            return;
        }
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("state", state);
        call.resolve(out);
    }
}
