import { EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { localizePosts } from "@/lib/content/localize";
import { type FeedPost } from "@/lib/feed";
import { getLocale } from "@/lib/i18n/server";
import { signPostImages } from "@/lib/photo";
import { createClient } from "@/lib/supabase/server";

import { FeedCard } from "../feed/feed-card";

interface Row extends FeedPost {
  content_type: string | null;
  extraction: { payload?: unknown } | null;
  redacted_image_path: string | null;
}

/**
 * A category "library": the newest published posts of one content_type for the
 * org, rendered as tappable FeedCards (detail sheet + admin take-down + masked
 * photo, all reused from the feed). Reads posts_public under RLS (org-scoped);
 * masked-photo signed URLs are minted server-side with the admin client, exactly
 * like /feed. `match` lets a category fold in unconfirmed (null) posts (info).
 */
export async function CategoryFeed({
  contentType,
  emptyTitle,
  includeNull = false,
}: {
  contentType: string;
  emptyTitle: string;
  includeNull?: boolean;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const isAdmin = session.role === "admin" || session.role === "superadmin";

  const filter = includeNull
    ? `content_type.eq.${contentType},content_type.is.null`
    : `content_type.eq.${contentType}`;

  const [{ data }, profileResult] = await Promise.all([
    supabase
      .from("posts_public")
      .select(
        "id, title, body, content_type, extraction, redacted_image_path, published_at",
      )
      .or(filter)
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("photo_consent")
      .eq("id", session.userId)
      .maybeSingle(),
  ]);

  const rows = (data ?? []) as Row[];
  const photoConsent = profileResult.data?.photo_consent ?? false;

  // Translation overlay and image signing are independent — run concurrently.
  // signPostImages reads only id + redacted_image_path (unchanged by localizing),
  // so derive the image set from the raw rows. For German the translation fetch
  // short-circuits with no query.
  const withImg = rows.filter((p) => p.redacted_image_path);
  const [list, imageUrls] = await Promise.all([
    localizePosts(rows, await getLocale()),
    withImg.length > 0
      ? signPostImages(withImg, session.orgId, photoConsent)
      : Promise.resolve(new Map<string, string>()),
  ]);

  if (list.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="grid gap-3">
      {list.map((p) => (
        <FeedCard
          key={p.id}
          isAdmin={isAdmin}
          post={{
            id: p.id,
            title: p.title,
            body: p.body,
            content_type: p.content_type ?? null,
            published_at: p.published_at,
            payload: p.extraction?.payload ?? null,
            imageUrl: imageUrls.get(p.id) ?? null,
          }}
        />
      ))}
    </div>
  );
}
