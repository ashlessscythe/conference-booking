"use client";

import { useState, useTransition } from "react";
import { requestMagicLink } from "@/features/auth/actions";
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

export function LoginForm({
  callbackUrl,
  room,
  start,
  end,
  title,
}: {
  callbackUrl: string;
  room?: string;
  start?: string;
  end?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{submitted ? "Check your email" : "Sign in"}</CardTitle>
        <CardDescription>
          {submitted
            ? "If Resend is not configured, open the magic link printed in the server console."
            : room
              ? "Sign in to finish booking this room. We'll bring you right back."
              : "Magic link — no password required."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? null : (
          <form
            action={(fd) => {
              startTransition(async () => {
                setSubmitted(true);
                await requestMagicLink(fd);
              });
            }}
            className="space-y-4"
          >
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            {room && <input type="hidden" name="room" value={room} />}
            {start && <input type="hidden" name="start" value={start} />}
            {end && <input type="hidden" name="end" value={end} />}
            {title && <input type="hidden" name="title" value={title} />}
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                className="h-12 text-base"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={pending}
            >
              {pending ? "Sending…" : "Email magic link"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
