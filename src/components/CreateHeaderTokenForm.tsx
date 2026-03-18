"use client";

import { Button } from "@app/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { Input } from "@app/components/ui/input";
import { toast } from "@app/hooks/useToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Credenza,
    CredenzaBody,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaFooter,
    CredenzaHeader,
    CredenzaTitle
} from "@app/components/Credenza";
import { formatAxiosError } from "@app/lib/api";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { useTranslations } from "next-intl";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@app/components/ui/select";
import { SwitchInput } from "@/components/SwitchInput";
import { Copy, Check } from "lucide-react";

const createHeaderTokenSchema = z.object({
    title: z.string().max(255).optional(),
    neverExpire: z.boolean(),
    expiresInValue: z.number().int().positive().optional(),
    expiresInUnit: z.enum(["hours", "days", "months"]).optional()
});

type CreateHeaderTokenValues = z.infer<typeof createHeaderTokenSchema>;

type CreateHeaderTokenFormProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
    resourceId: number;
    onTokenCreated?: () => void;
};

export default function CreateHeaderTokenForm({
    open,
    setOpen,
    resourceId,
    onTokenCreated
}: CreateHeaderTokenFormProps) {
    const api = createApiClient(useEnvContext());
    const t = useTranslations();

    const [loading, setLoading] = useState(false);
    const [createdToken, setCreatedToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const form = useForm<CreateHeaderTokenValues>({
        resolver: zodResolver(createHeaderTokenSchema),
        defaultValues: {
            title: "",
            neverExpire: true,
            expiresInValue: 24,
            expiresInUnit: "hours"
        }
    });

    useEffect(() => {
        if (!open) {
            return;
        }
        form.reset();
        setCreatedToken(null);
        setCopied(false);
    }, [open]);

    function computeExpiresInSeconds(data: CreateHeaderTokenValues): number | undefined {
        if (data.neverExpire) return undefined;
        const value = data.expiresInValue || 24;
        const unit = data.expiresInUnit || "hours";
        switch (unit) {
            case "hours":
                return value * 3600;
            case "days":
                return value * 86400;
            case "months":
                return value * 2592000; // 30 days
            default:
                return value * 3600;
        }
    }

    async function onSubmit(data: CreateHeaderTokenValues) {
        setLoading(true);

        const expiresIn = computeExpiresInSeconds(data);

        api.post(`/resource/${resourceId}/header-token`, {
            title: data.title || undefined,
            expiresIn
        })
            .then((res) => {
                const token = res.data.data.token;
                setCreatedToken(token);

                toast({
                    title: t("headerTokenCreated"),
                    description: t("headerTokenCreatedDescription")
                });

                if (onTokenCreated) {
                    onTokenCreated();
                }
            })
            .catch((e) => {
                toast({
                    variant: "destructive",
                    title: t("headerTokenErrorCreate"),
                    description: formatAxiosError(
                        e,
                        t("headerTokenErrorCreateDescription")
                    )
                });
            })
            .finally(() => setLoading(false));
    }

    function copyToken() {
        if (createdToken) {
            navigator.clipboard.writeText(createdToken);
            setCopied(true);
            toast({
                title: t("headerTokenCopied")
            });
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const neverExpire = form.watch("neverExpire");

    return (
        <Credenza
            open={open}
            onOpenChange={(val) => {
                setOpen(val);
                setLoading(false);
                form.reset();
                setCreatedToken(null);
                setCopied(false);
            }}
        >
            <CredenzaContent>
                <CredenzaHeader>
                    <CredenzaTitle>
                        {t("headerTokenCreateTitle")}
                    </CredenzaTitle>
                    <CredenzaDescription>
                        {t("headerTokenCreateDescription")}
                    </CredenzaDescription>
                </CredenzaHeader>
                <CredenzaBody>
                    {createdToken ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground font-medium">
                                {t("headerTokenCreatedDescription")}
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-muted p-3 rounded text-sm break-all font-mono">
                                    {createdToken}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copyToken}
                                >
                                    {copied ? (
                                        <Check size={16} />
                                    ) : (
                                        <Copy size={16} />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-4"
                                id="create-header-token-form"
                            >
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t("headerTokenTitle")}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    autoComplete="off"
                                                    placeholder={t(
                                                        "headerTokenTitlePlaceholder"
                                                    )}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="neverExpire"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <SwitchInput
                                                    id="never-expire-toggle"
                                                    label={t(
                                                        "headerTokenNeverExpire"
                                                    )}
                                                    checked={field.value}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {!neverExpire && (
                                    <div className="flex gap-2">
                                        <FormField
                                            control={form.control}
                                            name="expiresInValue"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel>
                                                        {t(
                                                            "headerTokenExpiration"
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            {...field}
                                                            onChange={(e) =>
                                                                field.onChange(
                                                                    parseInt(
                                                                        e.target
                                                                            .value
                                                                    ) || 1
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="expiresInUnit"
                                            render={({ field }) => (
                                                <FormItem className="w-32">
                                                    <FormLabel>&nbsp;</FormLabel>
                                                    <Select
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="hours">
                                                                {t("hours")}
                                                            </SelectItem>
                                                            <SelectItem value="days">
                                                                {t("days")}
                                                            </SelectItem>
                                                            <SelectItem value="months">
                                                                {t("months")}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </form>
                        </Form>
                    )}
                </CredenzaBody>
                <CredenzaFooter>
                    <CredenzaClose asChild>
                        <Button variant="outline">{t("close")}</Button>
                    </CredenzaClose>
                    {!createdToken && (
                        <Button
                            type="submit"
                            form="create-header-token-form"
                            loading={loading}
                            disabled={loading}
                        >
                            {t("headerTokenSubmit")}
                        </Button>
                    )}
                </CredenzaFooter>
            </CredenzaContent>
        </Credenza>
    );
}
