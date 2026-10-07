const SQUARE_VERSION = "2026-08-19";

const REFRESH_EARLY_MS =
  7 * 24 * 60 * 60 * 1000;

type SquarePrivateSettings = {
  square_access_token?: string | null;
  square_refresh_token?: string | null;
  square_token_expires_at?: string | null;
};

export async function getValidSquareAccessToken(args: {
  db: any;
  businessId: number;
  settings: SquarePrivateSettings;
}) {
  const {
    db,
    businessId,
    settings,
  } = args;

  const accessToken =
    String(
      settings?.square_access_token || "",
    ).trim();

  const refreshToken =
    String(
      settings?.square_refresh_token || "",
    ).trim();

  const expiresAtText =
    String(
      settings?.square_token_expires_at || "",
    ).trim();

  if (!accessToken) {
    throw new Error(
      "Square is not connected for this restaurant.",
    );
  }

  const expiresAtMs =
    expiresAtText
      ? Date.parse(expiresAtText)
      : Number.NaN;

  const shouldRefresh =
    Number.isFinite(expiresAtMs) &&
    expiresAtMs - Date.now() <= REFRESH_EARLY_MS;

  if (!shouldRefresh) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error(
      "Square authorization expired. Please reconnect this restaurant's Square account.",
    );
  }

  const clientId =
    String(
      process.env.SQUARE_APPLICATION_ID || "",
    ).trim();

  const clientSecret =
    String(
      process.env.SQUARE_APPLICATION_SECRET || "",
    ).trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Square OAuth server configuration is missing.",
    );
  }

  console.log(
    "Refreshing Square OAuth token",
    {
      businessId,
      expiresAt: expiresAtText,
    },
  );

  const response =
    await fetch(
      "https://connect.squareup.com/oauth2/token",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
        },

        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),

        cache: "no-store",
      },
    );

  const payload =
    await response
      .json()
      .catch(() => ({}));

  if (
    !response.ok ||
    !payload?.access_token
  ) {
    console.error(
      "SQUARE TOKEN REFRESH ERROR",
      {
        businessId,
        httpStatus: response.status,
        errors: payload?.errors || null,
      },
    );

    throw new Error(
      "Square authorization could not be refreshed. Please reconnect this restaurant's Square account.",
    );
  }

  const newAccessToken =
    String(
      payload.access_token,
    ).trim();

  const newRefreshToken =
    String(
      payload.refresh_token ||
      refreshToken,
    ).trim();

  const newExpiresAt =
    payload.expires_at
      ? String(payload.expires_at)
      : null;

  const {
    error: saveError,
  } =
    await db
      .from(
        "restaurant_order_private_settings",
      )
      .update({
        square_access_token:
          newAccessToken,

        square_refresh_token:
          newRefreshToken,

        square_token_expires_at:
          newExpiresAt,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "business_id",
        businessId,
      );

  if (saveError) {
    console.error(
      "SQUARE TOKEN REFRESH SAVE ERROR",
      saveError,
    );

    throw new Error(
      "Square token was refreshed but could not be saved.",
    );
  }

  console.log(
    "Square OAuth token refreshed",
    {
      businessId,
      expiresAt: newExpiresAt,
    },
  );

  return newAccessToken;
}
