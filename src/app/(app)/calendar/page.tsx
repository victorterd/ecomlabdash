import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Calendar" };

export default function Page() {
  return (
    <ComingSoon title="Calendar" stage={3}>
      Zile de filmare, deadline-uri și follow-up-uri.
    </ComingSoon>
  );
}
