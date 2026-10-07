          expires: quote.expires || null,
          duration: quote.duration || 0,
          pickupDuration: quote.pickup_duration || 0,
          dropoffEta: quote.dropoff_eta || null,
          dropoffDeadline: quote.dropoff_deadline || null,
        },
        order: {
          ...order,
          delivery_quote_id: quote.id,
          delivery_quote_expires_at: quote.expires || null,
          delivery_status: "quote_ready",
        },
      });
    }

    // STEP 2: Actual Uber delivery creation.
    if (order.delivery_external_id) {
      return NextResponse.json({
        ok: true,
        stage: "dispatch",
        alreadyDispatched: true,
        message: "Uber Direct delivery already exists.",
        pickupAddress,
        dropoffAddress,
        order,
      });
    }

    console.log("========== UBER DIRECT DISPATCH TEST START ==========");
    console.log("Business ID:", businessId);
    console.log("Order ID:", orderId);
    console.log("Order Number:", order.order_number);
    console.log("Quote ID:", order.delivery_quote_id);

    try {
      // Square / Receipt / SMS calls are intentionally not used here.
      const result = await dispatchUberDirectOrder({
        db,
        businessId,
        orderId,
        prepMinutes: 15,
      });

      const { data: updatedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_quote_expires_at,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      console.log("UBER DIRECT DISPATCH RESULT:", result);
      console.log("========== UBER DIRECT DISPATCH TEST END ==========");

      return NextResponse.json({
        ok: true,
        stage: "dispatch",
        message: "Uber Direct delivery creation completed.",
        pickupAddress,
        dropoffAddress,
        uberResult: result,
        order: updatedOrder || order,
      });
    } catch (uberError) {
      const message =
        uberError instanceof Error ? uberError.message : String(uberError);

      console.error("========== UBER DIRECT DISPATCH TEST FAILED ==========");
      console.error("Business ID:", businessId);
      console.error("Order ID:", orderId);
      console.error("ERROR:", message);

      const { data: failedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_quote_expires_at,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      return NextResponse.json(
        {
          ok: false,
          stage: "dispatch",
          error: message,
          pickupAddress,
          dropoffAddress,
          order: failedOrder || order,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("UBER DIRECT TEST ROUTE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Uber Direct test failed.",
      },
      { status: 500 },
    );
  }
