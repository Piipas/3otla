"use client";

import { checkSourceUrl } from "@3otla/data/sources";
import { CheckCircle2, ExternalLink, Loader2, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

const KINDS = ["confirmation", "correction", "school-calendar"] as const;
type Kind = (typeof KINDS)[number];

type Values = Record<string, string>;
type Errors = Partial<Record<string, string>>;

type State =
  | { step: "editing" }
  | { step: "sending" }
  | { step: "sent"; number: number; url: string }
  | { step: "fallback"; url: string };

export interface ContributeFormProps {
  hijriHolidays: { id: string; label: string }[];
  defaultHijriYear: number;
  /** GitHub repository, for the fallback when direct sending is unavailable. */
  repoUrl: string;
}

const FIELDS: Record<Kind, string[]> = {
  confirmation: [
    "holidayId",
    "hijriYear",
    "date",
    "announcedAt",
    "sourceUrl",
    "details",
    "contact",
  ],
  correction: ["subject", "proposedDate", "details", "sourceUrl", "contact"],
  "school-calendar": ["schoolYear", "sourceUrl", "details", "contact"],
};

const REQUIRED: Record<Kind, string[]> = {
  confirmation: ["holidayId", "hijriYear", "date", "announcedAt", "sourceUrl"],
  correction: ["subject", "details", "sourceUrl"],
  "school-calendar": ["schoolYear", "sourceUrl"],
};

const isKind = (v: string | null): v is Kind => KINDS.includes(v as Kind);

/** Contribution form: validates on the client, posts to the API, falls back to GitHub. */
export function ContributeForm({ hijriHolidays, defaultHijriYear, repoUrl }: ContributeFormProps) {
  const t = useTranslations("contribute");
  const params = useSearchParams();
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<Kind>("confirmation");
  const [values, setValues] = useState<Values>({
    holidayId: hijriHolidays[0]?.id ?? "",
    hijriYear: String(defaultHijriYear),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ step: "editing" });

  // Pre-fill from links such as /contribute?kind=confirmation&holidayId=eid-al-fitr&hijriYear=1448
  useEffect(() => {
    const k = params.get("kind");
    if (isKind(k)) setKind(k);
    const prefill: Values = {};
    for (const key of ["holidayId", "hijriYear", "subject", "schoolYear"]) {
      const v = params.get(key);
      if (v) prefill[key] = v.slice(0, 120);
    }
    if (Object.keys(prefill).length) setValues((prev) => ({ ...prev, ...prefill }));
  }, [params]);

  const set = (name: string) => (value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  function validate(): Errors {
    const out: Errors = {};
    for (const name of REQUIRED[kind]) if (!values[name]?.trim()) out[name] = t("errors.required");
    const url = values.sourceUrl?.trim();
    if (url && !out.sourceUrl) {
      if (!/^https:\/\/\S+$/.test(url)) out.sourceUrl = t("errors.url");
      else if (!checkSourceUrl(url).ok) out.sourceUrl = t("errors.source");
    }
    if (kind === "correction" && values.details && values.details.trim().length < 20) {
      out.details = t("errors.tooShort");
    }
    if (
      kind === "school-calendar" &&
      values.schoolYear &&
      !/^\d{4}-\d{4}$/.test(values.schoolYear)
    ) {
      out.schoolYear = t("errors.schoolYear");
    }
    return out;
  }

  function payload() {
    const body: Record<string, string | number> = { kind };
    for (const name of FIELDS[kind]) {
      const v = values[name]?.trim();
      if (v) body[name] = name === "hijriYear" ? Number(v) : v;
    }
    return body;
  }

  function githubFallbackUrl() {
    const body = payload();
    const lines = Object.entries(body).map(([k, v]) => `- **${k}**: ${v}`);
    const url = new URL(`${repoUrl}/issues/new`);
    url.searchParams.set("title", `Contribution (${kind})`);
    url.searchParams.set("labels", "contribution");
    url.searchParams.set("body", lines.join("\n"));
    return url.toString();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setState({ step: "sending" });
    const honeypot = new FormData(event.currentTarget).get("website");
    try {
      const res = await fetch("/api/v1/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), ...(honeypot ? { website: honeypot } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.data) {
        setState({ step: "sent", number: json.data.issue, url: json.data.url });
        return;
      }
      setState({ step: "editing" });
      const code: string | undefined = json?.error?.code;
      if (code === "contributions_disabled")
        setState({ step: "fallback", url: githubFallbackUrl() });
      else if (code === "invalid_source") setErrors({ sourceUrl: t("errors.source") });
      else if (code === "implausible_date") setErrors({ date: t("errors.implausible") });
      else if (res.status === 429) setServerError(t("errors.rateLimited"));
      else setServerError(t("errors.generic"));
    } catch {
      setState({ step: "editing" });
      setServerError(t("errors.generic"));
    }
  }

  if (state.step === "sent") {
    return (
      <div
        role="status"
        className="rounded-xl border border-confirmed/30 bg-confirmed-soft/50 p-6 sm:p-8"
      >
        <CheckCircle2 className="size-8 text-confirmed" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-semibold">{t("success.title")}</h2>
        <p className="mt-2 text-muted">{t("success.body", { number: state.number })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={state.url} target="_blank" rel="noopener" className={buttonVariants()}>
            {t("success.link")}
            <ExternalLink aria-hidden="true" />
          </a>
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            onClick={() => {
              setValues({
                holidayId: hijriHolidays[0]?.id ?? "",
                hijriYear: String(defaultHijriYear),
              });
              setState({ step: "editing" });
            }}
          >
            {t("success.another")}
          </button>
        </div>
      </div>
    );
  }

  const errorList = Object.entries(errors).filter((e): e is [string, string] => Boolean(e[1]));
  const field = (name: string) => ({
    id: `${formId}-${name}`,
    name,
    value: values[name] ?? "",
    onChange: set(name),
    error: errors[name],
    required: REQUIRED[kind].includes(name),
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-8"
      aria-describedby={`${formId}-notice`}
    >
      {errorList.length ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby={`${formId}-summary`}
          className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm"
        >
          <p id={`${formId}-summary`} className="font-semibold text-accent">
            {t("errors.summary")}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {errorList.map(([name, message]) => (
              <li key={name}>
                <a href={`#${formId}-${name}`} className="underline underline-offset-4">
                  {t(`fields.${name}` as "fields.date")}
                </a>
                : {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-3 font-semibold">{t("kindLabel")}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-lg border bg-surface p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                kind === k ? "border-brand ring-1 ring-brand" : "border-line hover:border-ink/30",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setErrors({});
                }}
                className="sr-only"
              />
              <span className="font-medium">{t(`kinds.${k}.title`)}</span>
              <span className="mt-1 text-sm text-muted">{t(`kinds.${k}.desc`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        {kind === "confirmation" ? (
          <>
            <Field label={t("fields.holiday")} {...field("holidayId")}>
              {(p) => (
                <select {...p} className={inputClass(p["aria-invalid"])}>
                  {hijriHolidays.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("fields.hijriYear")} {...field("hijriYear")}>
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1440}
                  max={1600}
                  className={inputClass(p["aria-invalid"])}
                />
              )}
            </Field>
            <Field label={t("fields.date")} {...field("date")}>
              {(p) => <input {...p} type="date" className={inputClass(p["aria-invalid"])} />}
            </Field>
            <Field label={t("fields.announcedAt")} {...field("announcedAt")}>
              {(p) => (
                <input {...p} type="datetime-local" className={inputClass(p["aria-invalid"])} />
              )}
            </Field>
          </>
        ) : null}

        {kind === "correction" ? (
          <>
            <Field label={t("fields.subject")} hint={t("fields.subjectHint")} {...field("subject")}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  maxLength={120}
                  className={inputClass(p["aria-invalid"])}
                />
              )}
            </Field>
            <Field
              label={t("fields.proposedDate")}
              optional={t("fields.optional")}
              {...field("proposedDate")}
            >
              {(p) => <input {...p} type="date" className={inputClass(p["aria-invalid"])} />}
            </Field>
          </>
        ) : null}

        {kind === "school-calendar" ? (
          <Field
            label={t("fields.schoolYear")}
            hint={t("fields.schoolYearHint")}
            {...field("schoolYear")}
          >
            {(p) => (
              <input
                {...p}
                type="text"
                inputMode="numeric"
                placeholder="2027-2028"
                pattern="\d{4}-\d{4}"
                className={inputClass(p["aria-invalid"])}
              />
            )}
          </Field>
        ) : null}

        <Field
          label={t("fields.sourceUrl")}
          hint={t("fields.sourceHint")}
          className="sm:col-span-2"
          {...field("sourceUrl")}
        >
          {(p) => (
            <input
              {...p}
              type="url"
              inputMode="url"
              dir="ltr"
              placeholder="https://www.habous.gov.ma/…"
              className={inputClass(p["aria-invalid"])}
            />
          )}
        </Field>

        <Field
          label={t("fields.details")}
          hint={kind === "correction" ? t("fields.detailsHint") : undefined}
          optional={kind === "correction" ? undefined : t("fields.optional")}
          className="sm:col-span-2"
          {...field("details")}
        >
          {(p) => (
            <textarea
              {...p}
              rows={4}
              maxLength={2000}
              className={cn(inputClass(p["aria-invalid"]), "h-auto py-3")}
            />
          )}
        </Field>

        <Field label={t("fields.contact")} optional={t("fields.optional")} {...field("contact")}>
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={100}
              autoComplete="nickname"
              className={inputClass(p["aria-invalid"])}
            />
          )}
        </Field>
      </div>

      {/* Honeypot: invisible to people, tempting for bots. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.step === "fallback" ? (
        <div
          role="status"
          className="rounded-lg border border-estimated/40 bg-estimated-soft/50 p-4"
        >
          <p className="font-semibold">{t("disabled.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("disabled.body")}</p>
          <a
            href={state.url}
            target="_blank"
            rel="noopener"
            className={cn(buttonVariants({ size: "sm" }), "mt-3")}
          >
            {t("disabled.link")}
            <ExternalLink aria-hidden="true" />
          </a>
        </div>
      ) : null}

      {serverError ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <p id={`${formId}-notice`} className="text-sm text-muted sm:me-auto">
          {t("publicNotice")}
        </p>
        <button
          type="submit"
          disabled={state.step === "sending"}
          aria-busy={state.step === "sending"}
          className={buttonVariants({ size: "lg" })}
        >
          {state.step === "sending" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send className="rtl:-scale-x-100" aria-hidden="true" />
          )}
          {state.step === "sending" ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}

function inputClass(invalid?: boolean) {
  return cn(
    "block h-11 w-full rounded-lg border bg-surface px-3 text-base text-ink transition-colors placeholder:text-muted/70 focus-visible:border-brand",
    invalid ? "border-accent" : "border-line hover:border-ink/30",
  );
}

interface ControlProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function Field({
  id,
  name,
  label,
  hint,
  optional,
  error,
  value,
  onChange,
  required,
  className,
  children,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  optional?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional ? <span className="ms-1 font-normal text-muted">({optional})</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="mb-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        name,
        value,
        onChange: (e) => onChange(e.target.value),
        ...(required ? { required: true } : {}),
        ...(error ? { "aria-invalid": true } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
