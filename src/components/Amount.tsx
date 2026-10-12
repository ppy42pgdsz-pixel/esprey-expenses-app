// Amount with the currency code set lighter before the number: "EUR 1,284.60".
// Always mono. Renders "—" when there is no amount.
import { formatNumber } from "../../shared/format";

export default function Amount({
  amount,
  currency,
  className,
}: {
  amount: string | number | null | undefined;
  currency?: string | null;
  className?: string;
}) {
  const num = formatNumber(amount, currency);
  const code = (currency ?? "").toUpperCase();
  return (
    <span className={"amt" + (className ? ` ${className}` : "")}>
      {num ? (
        <>
          {code ? <span className="cur-code">{code}</span> : null}
          {num}
        </>
      ) : (
        "—"
      )}
    </span>
  );
}
