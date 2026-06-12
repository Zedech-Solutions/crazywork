import { Fragment } from "react";

// Renders editable copy: "\n" becomes a line break, and *word* becomes an
// accent-coloured span. Server-safe (no client JS).
export function RichText({
  text,
  accentClass = "text-ember",
}: {
  text: string;
  accentClass?: string;
}) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, pi) =>
            part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
              <span key={pi} className={accentClass}>
                {part.slice(1, -1)}
              </span>
            ) : (
              <Fragment key={pi}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
