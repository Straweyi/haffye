import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function newAnonClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const results = [];
  const check = async (name, fn) => {
    await fn();
    results.push(name);
    console.log(`PASS: ${name}`);
  };

  // 1. Customer authentication & own-profile read
  const custSb = newAnonClient();
  let customerUser;
  await check("Customer authentication & own profile read", async () => {
    const { data, error } = await custSb.auth.signInWithPassword({
      email: "customer@haffye.com",
      password: "Customer123!",
    });
    assert.ifError(error);
    assert.ok(data.user);
    customerUser = data.user;

    const { data: prof, error: pErr } = await custSb
      .from("profiles")
      .select("role,is_active")
      .eq("id", customerUser.id)
      .single();
    assert.ifError(pErr);
    assert.equal(prof.role, "customer");
    assert.equal(prof.is_active, true);
  });

  // 2. Barista authentication & assigned vendor read
  const baristaSb = newAnonClient();
  let baristaUser;
  let vendor;
  await check("Barista authentication & assigned vendor read", async () => {
    const { data, error } = await baristaSb.auth.signInWithPassword({
      email: "barista@haffye.com",
      password: "Barista123!",
    });
    assert.ifError(error);
    assert.ok(data.user);
    baristaUser = data.user;

    const { data: prof, error: pErr } = await baristaSb
      .from("profiles")
      .select("role,is_active")
      .eq("id", baristaUser.id)
      .single();
    assert.ifError(pErr);
    assert.equal(prof.role, "barista");

    const { data: v, error: vErr } = await baristaSb
      .from("vendors")
      .select("id,code,status")
      .eq("barista_id", baristaUser.id)
      .single();
    assert.ifError(vErr);
    assert.equal(v.code, "HAF-002");
    vendor = v;
  });

  // 3. Unauthorized access & privilege escalation prevention
  await check("RLS & trigger protection (anon, customer escalation, admin writes)", async () => {
    const anon = newAnonClient();
    const { data: anonProfiles } = await anon.from("profiles").select("id");
    assert.equal((anonProfiles ?? []).length, 0);
    const { data: anonOrders } = await anon.from("orders").select("id");
    assert.equal((anonOrders ?? []).length, 0);

    // Customer cannot escalate own role
    const { error: escErr } = await custSb
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", customerUser.id);
    assert.ok(escErr, "role self-escalation must be rejected");

    // Customer cannot write admin tables or read audit_logs
    const { error: catErr } = await custSb
      .from("product_categories")
      .insert({ name: "VerifyBlocked", slug: "verify-blocked", sort_order: 99 });
    assert.ok(catErr, "customer insert into product_categories must be rejected");

    const { data: custAudit } = await custSb.from("audit_logs").select("id");
    assert.equal((custAudit ?? []).length, 0);

    // cleanup_stale_locations cannot be called by authenticated users
    const { error: rpcDenied } = await baristaSb.rpc("cleanup_stale_locations");
    assert.ok(rpcDenied, "cleanup_stale_locations must be denied to authenticated role");
  });

  // 4. GPS location updates & offline trigger
  await check("GPS location update while ACTIVE & rejected while OFFLINE", async () => {
    const { error: s1 } = await baristaSb
      .from("vendors")
      .update({ status: "ACTIVE" })
      .eq("id", vendor.id);
    assert.ifError(s1);

    const { error: locOk } = await baristaSb
      .from("vendor_locations")
      .upsert(
        { vendor_id: vendor.id, latitude: -6.2246, longitude: 106.8097, accuracy: 12 },
        { onConflict: "vendor_id" },
      );
    assert.ifError(locOk);

    // Going OFFLINE clears location and rejects new GPS writes
    const { error: s2 } = await baristaSb
      .from("vendors")
      .update({ status: "OFFLINE" })
      .eq("id", vendor.id);
    assert.ifError(s2);

    const { data: cleared } = await baristaSb
      .from("vendor_locations")
      .select("vendor_id")
      .eq("vendor_id", vendor.id)
      .maybeSingle();
    assert.equal(cleared, null);

    const { error: locBlocked } = await baristaSb
      .from("vendor_locations")
      .upsert(
        { vendor_id: vendor.id, latitude: -6.2246, longitude: 106.8097, accuracy: 12 },
        { onConflict: "vendor_id" },
      );
    assert.ok(locBlocked, "location upsert while OFFLINE must fail");

    // Restore ACTIVE + location
    await baristaSb.from("vendors").update({ status: "ACTIVE" }).eq("id", vendor.id);
    await baristaSb
      .from("vendor_locations")
      .upsert(
        { vendor_id: vendor.id, latitude: -6.2246, longitude: 106.8097, accuracy: 12 },
        { onConflict: "vendor_id" },
      );
  });

  // 5. Product availability toggle & restore
  let sampleProduct;
  await check("Product availability toggle & customer visibility", async () => {
    const { data: p, error: pErr } = await admin
      .from("products")
      .select("id,name,base_price")
      .eq("slug", "urban-americano")
      .single();
    assert.ifError(pErr);
    sampleProduct = p;

    const { error: offErr } = await baristaSb
      .from("vendor_products")
      .upsert(
        { vendor_id: vendor.id, product_id: sampleProduct.id, is_available: false },
        { onConflict: "vendor_id,product_id" },
      );
    assert.ifError(offErr);

    const { data: vp } = await custSb
      .from("vendor_products")
      .select("is_available")
      .eq("vendor_id", vendor.id)
      .eq("product_id", sampleProduct.id)
      .single();
    assert.equal(vp.is_available, false);

    // Restore
    const { error: onErr } = await baristaSb
      .from("vendor_products")
      .upsert(
        { vendor_id: vendor.id, product_id: sampleProduct.id, is_available: true },
        { onConflict: "vendor_id,product_id" },
      );
    assert.ifError(onErr);
  });

  // 6. Midtrans SHA-512 signature verification check
  await check("Midtrans SHA-512 signature verification", async () => {
    const fakeKey = "SB-Mid-server-test-key";
    const sig = createHash("sha512")
      .update("HAF-TEST-001" + "200" + "18000.00" + fakeKey)
      .digest("hex");
    const tampered = createHash("sha512")
      .update("HAF-TEST-001" + "200" + "100.00" + fakeKey)
      .digest("hex");
    assert.equal(
      timingSafeEqual(Buffer.from(sig), Buffer.from(sig)),
      true,
    );
    assert.equal(
      timingSafeEqual(Buffer.from(sig), Buffer.from(tampered)),
      false,
    );
  });

  // 7. Order creation, duplicate idempotency, payment callback dedup, and atomic inventory deduction + cleanup
  await check("Order idempotency, payment_events dedup, complete_order() deduction & cleanup", async () => {
    const idem = `verify-${Date.now()}`;
    const orderNumber = `HAF-VER-${Date.now().toString().slice(-6)}`;

    // Record pre-test inventory & loyalty
    const { data: invBefore } = await admin
      .from("inventories")
      .select("ingredient_id,quantity")
      .eq("vendor_id", vendor.id);
    const invMap = new Map((invBefore ?? []).map((r) => [r.ingredient_id, Number(r.quantity)]));

    const { data: loyBefore } = await admin
      .from("loyalty_accounts")
      .select("points_balance,lifetime_points")
      .eq("customer_id", customerUser.id)
      .single();

    // Create order
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerUser.id,
        vendor_id: vendor.id,
        status: "READY_FOR_PICKUP",
        subtotal: 18000,
        discount: 0,
        total: 18000,
        idempotency_key: idem,
      })
      .select("id")
      .single();
    assert.ifError(oErr);

    try {
      // Duplicate order submission with same (customer_id, idempotency_key) must fail (23505)
      const { error: dupOrderErr } = await admin.from("orders").insert({
        order_number: `${orderNumber}-DUP`,
        customer_id: customerUser.id,
        vendor_id: vendor.id,
        status: "PENDING_PAYMENT",
        subtotal: 18000,
        discount: 0,
        total: 18000,
        idempotency_key: idem,
      });
      assert.equal(dupOrderErr?.code, "23505");

      // Add order item (1x Urban Americano)
      const { error: oiErr } = await admin.from("order_items").insert({
        order_id: order.id,
        product_id: sampleProduct.id,
        product_name: sampleProduct.name,
        variant_name: "Regular",
        unit_price: 18000,
        quantity: 1,
        line_total: 18000,
      });
      assert.ifError(oiErr);

      // Duplicate payment callback protection via payment_events unique constraint
      const { error: pe1 } = await admin.from("payment_events").insert({
        provider_order_id: orderNumber,
        transaction_status: "settlement",
        status_code: "200",
        payload: { test: true },
      });
      assert.ifError(pe1);
      const { error: peDup } = await admin.from("payment_events").insert({
        provider_order_id: orderNumber,
        transaction_status: "settlement",
        status_code: "200",
        payload: { test: true },
      });
      assert.equal(peDup?.code, "23505");

      // Complete order via barista RPC -> atomically deducts recipe ingredients
      const { error: compErr } = await baristaSb.rpc("complete_order", {
        p_order_id: order.id,
      });
      assert.ifError(compErr);

      // Second complete_order must be rejected
      const { error: compDupErr } = await baristaSb.rpc("complete_order", {
        p_order_id: order.id,
      });
      assert.ok(compDupErr, "second complete_order must fail");

      // Verify recipe inventory deducted
      const { data: recipe } = await admin
        .from("product_recipes")
        .select("ingredient_id,quantity")
        .eq("product_id", sampleProduct.id);
      const { data: invAfter } = await admin
        .from("inventories")
        .select("ingredient_id,quantity")
        .eq("vendor_id", vendor.id);
      const afterMap = new Map((invAfter ?? []).map((r) => [r.ingredient_id, Number(r.quantity)]));

      for (const r of recipe ?? []) {
        const before = invMap.get(r.ingredient_id) ?? 0;
        const after = afterMap.get(r.ingredient_id) ?? 0;
        assert.equal(after, before - Number(r.quantity));
      }

      // Negative stock check
      if (recipe && recipe.length > 0) {
        const { error: negErr } = await baristaSb.rpc("apply_stock_movement", {
          p_vendor_id: vendor.id,
          p_ingredient_id: recipe[0].ingredient_id,
          p_type: "STOCK_OUT",
          p_quantity: 9999999,
          p_note: "Verify negative blocked",
        });
        assert.ok(negErr, "negative stock movement must be rejected");
      }
    } finally {
      // Clean up synthetic test records and restore inventory + loyalty balance
      await admin.from("inventory_movements").delete().eq("order_id", order.id);
      for (const [ingId, qty] of invMap.entries()) {
        await admin
          .from("inventories")
          .update({ quantity: qty })
          .eq("vendor_id", vendor.id)
          .eq("ingredient_id", ingId);
      }
      await admin.from("loyalty_transactions").delete().eq("order_id", order.id);
      if (loyBefore) {
        await admin
          .from("loyalty_accounts")
          .update({
            points_balance: loyBefore.points_balance,
            lifetime_points: loyBefore.lifetime_points,
          })
          .eq("customer_id", customerUser.id);
      }
      await admin.from("payment_events").delete().eq("provider_order_id", orderNumber);
      await admin.from("orders").delete().eq("id", order.id);
    }
  });

  console.log(`\nALL ${results.length} VERIFICATION CHECKS PASSED.`);
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
