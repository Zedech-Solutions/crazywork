import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Public renderer for the block-based content builder (blog + collab).
// Block `data` shapes are defined by the admin editor; render defensively.

export interface ContentBlockData {
  id: string;
  type: "heading" | "paragraph" | "image" | "image_grid" | "quote" | "button";
  data: unknown;
}

function Heading({ data }: { data: { text?: string; level?: number } }) {
  const text = data.text ?? "";
  if (data.level === 3) {
    return <h3 className="subhead mt-10 text-2xl">{text}</h3>;
  }
  return <h2 className="headline mt-12 text-4xl">{text}</h2>;
}

/** Allows the basic inline emphasis the editor supports: **bold** and *italic*. */
function inlineEmphasis(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function BlockRenderer({ blocks }: { blocks: ContentBlockData[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const data = (block.data ?? {}) as Record<string, never>;
        switch (block.type) {
          case "heading":
            return <Heading key={block.id} data={data} />;
          case "paragraph":
            return (
              <p key={block.id} className="text-[15px] leading-[1.8] text-ink/85">
                {inlineEmphasis(String(data["text"] ?? ""))}
              </p>
            );
          case "image": {
            const url = data["url"] as string | undefined;
            if (!url) return null;
            return (
              <figure key={block.id} className="my-8">
                <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                  <Image
                    src={url}
                    alt={String(data["alt"] ?? "")}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover"
                  />
                </div>
                {data["alt"] ? (
                  <figcaption className="mt-2 text-xs text-warmgrey">
                    {data["alt"]}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
          case "image_grid": {
            const images =
              (data["images"] as { url: string; alt?: string }[] | undefined) ??
              [];
            const columns = Number(data["columns"] ?? 3);
            if (images.length === 0) return null;
            return (
              <div
                key={block.id}
                className="my-8 grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(Math.max(columns, 1), 4)}, minmax(0, 1fr))`,
                }}
              >
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden bg-ink"
                  >
                    <Image
                      src={img.url}
                      alt={img.alt ?? ""}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            );
          }
          case "quote":
            return (
              <blockquote
                key={block.id}
                className="my-10 border-l-4 border-ember pl-6"
              >
                <p className="headline text-3xl leading-tight">
                  &ldquo;{String(data["text"] ?? "")}&rdquo;
                </p>
                {data["attribution"] ? (
                  <cite className="mt-2 block eyebrow not-italic text-brown">
                    — {String(data["attribution"])}
                  </cite>
                ) : null}
              </blockquote>
            );
          case "button": {
            const href = String(data["href"] ?? "/shop");
            return (
              <div key={block.id} className="my-8">
                <Button asChild variant="accent" size="lg">
                  <Link href={href}>{String(data["label"] ?? "Shop")}</Link>
                </Button>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
