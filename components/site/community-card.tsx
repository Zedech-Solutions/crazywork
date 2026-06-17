import Image from "next/image";
import { CommunityInstagram } from "@/components/site/community-instagram";
import { cn } from "@/lib/utils";

export interface CommunityItem {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  postUrl: string | null;
}

// Shared community card — same fixed-height treatment on the home + community
// pages. Instagram posts keep their live carousel (faded at the bottom); plain
// uploads fill the same card. Pass `showCaption` to render the caption below.
export function CommunityCard({
  item,
  showCaption = false,
}: {
  item: CommunityItem;
  showCaption?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "relative h-[520px] w-full overflow-hidden rounded-2xl border border-warmgrey/40 shadow-sm",
          // Skip layout/paint for cards that are offscreen on this long media
          // grid; the intrinsic size keeps the scrollbar stable.
          "[content-visibility:auto] [contain-intrinsic-size:auto_520px]",
          item.postUrl ? "bg-white" : "bg-ink",
        )}
      >
        {item.postUrl ? (
          <CommunityInstagram url={item.postUrl} />
        ) : (
          item.imageUrl && (
            <Image
              src={item.imageUrl}
              alt={item.caption ?? "CRAZYWORK community"}
              fill
              sizes="340px"
              className="object-cover transition-transform duration-500 hover:scale-105"
            />
          )
        )}
      </div>
      {showCaption && item.caption && (
        <p className="mt-2.5 px-1 text-sm font-bold leading-snug text-ink">
          {item.caption}
        </p>
      )}
    </>
  );
}
