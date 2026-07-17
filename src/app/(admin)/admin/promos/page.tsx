import { requirePlatformOwner } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  createPromoCode,
  setPromoActive,
} from "@/features/billing/promo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function createAction(formData: FormData) {
  "use server";
  await createPromoCode({
    code: formData.get("code"),
    kind: formData.get("kind"),
    freeMonths: formData.get("freeMonths") || null,
    percentOff: formData.get("percentOff") || null,
    amountOffCents: formData.get("amountOffCents")
      ? Math.round(Number(formData.get("amountOffCents")) * 100)
      : null,
    durationMonths: formData.get("durationMonths") || null,
    maxRedemptions: formData.get("maxRedemptions") || null,
    expiresAt: formData.get("expiresAt") || null,
    note: formData.get("note") || null,
  });
}

export default async function AdminPromosPage() {
  await requirePlatformOwner();
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Promo codes</h2>
        <p className="text-muted-foreground">
          Platform-owner tools: grant free months or Stripe checkout discounts.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Create promo</CardTitle>
          <CardDescription>
            FREE_MONTHS grants Pro immediately. Discount kinds sync to Stripe
            when keys are set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                required
                placeholder="LAUNCH30"
                className="h-11 font-mono uppercase"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kind">Kind</Label>
              <select
                id="kind"
                name="kind"
                className="h-11 w-full rounded-lg border bg-background px-3"
                defaultValue="FREE_MONTHS"
              >
                <option value="FREE_MONTHS">Free months (grant Pro)</option>
                <option value="PERCENT_OFF">Percent off (Checkout)</option>
                <option value="AMOUNT_OFF">Amount off USD (Checkout)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeMonths">Free months</Label>
              <Input
                id="freeMonths"
                name="freeMonths"
                type="number"
                min={1}
                max={36}
                defaultValue={1}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="percentOff">Percent off</Label>
              <Input
                id="percentOff"
                name="percentOff"
                type="number"
                min={1}
                max={100}
                placeholder="30"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountOffCents">Amount off (USD)</Label>
              <Input
                id="amountOffCents"
                name="amountOffCents"
                type="number"
                min={0.01}
                step="0.01"
                placeholder="10.00"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMonths">Discount duration (months)</Label>
              <Input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min={1}
                max={36}
                placeholder="once if empty"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRedemptions">Max redemptions</Label>
              <Input
                id="maxRedemptions"
                name="maxRedemptions"
                type="number"
                min={1}
                placeholder="Unlimited"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires</Label>
              <Input
                id="expiresAt"
                name="expiresAt"
                type="date"
                className="h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Note</Label>
              <Input
                id="note"
                name="note"
                placeholder="Launch partners"
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 sm:col-span-2 sm:w-48">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {promos.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="font-mono text-lg">{p.code}</CardTitle>
                <CardDescription>
                  {p.kind}
                  {p.kind === "FREE_MONTHS" && p.freeMonths
                    ? ` · ${p.freeMonths} mo`
                    : ""}
                  {p.kind === "PERCENT_OFF" && p.percentOff
                    ? ` · ${p.percentOff}%`
                    : ""}
                  {p.kind === "AMOUNT_OFF" && p.amountOffCents
                    ? ` · $${(p.amountOffCents / 100).toFixed(2)}`
                    : ""}
                  {" · "}
                  {p.redemptionCount}
                  {p.maxRedemptions != null ? `/${p.maxRedemptions}` : ""}{" "}
                  redeemed
                  {!p.active ? " · inactive" : ""}
                </CardDescription>
              </div>
              <form
                action={async () => {
                  "use server";
                  await setPromoActive(p.id, !p.active);
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  {p.active ? "Disable" : "Enable"}
                </Button>
              </form>
            </CardHeader>
            {p.note && (
              <CardContent className="text-sm text-muted-foreground">
                {p.note}
              </CardContent>
            )}
          </Card>
        ))}
        {promos.length === 0 && (
          <p className="text-sm text-muted-foreground">No promo codes yet.</p>
        )}
      </div>
    </div>
  );
}
