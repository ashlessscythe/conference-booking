"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestSignupMagicLink } from "@/features/auth/actions";
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
import { FREE_ROOM_LIMIT } from "@/lib/billing/plans";

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{submitted ? "Check your email" : "Start free"}</CardTitle>
        <CardDescription>
          {submitted
            ? "Click the magic link we sent to create your workspace."
            : `Create your organization — up to ${FREE_ROOM_LIMIT} rooms free. Upgrade anytime for more.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        ) : (
          <form
            action={(fd) => {
              startTransition(async () => {
                try {
                  await requestSignupMagicLink(fd);
                  setSubmitted(true);
                } catch {
                  // Server redirects on success/failure; keep form on unexpected client errors.
                }
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                required
                className="h-12 text-base"
                placeholder="Acme Offices"
                autoComplete="organization"
              />
            </div>
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
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
