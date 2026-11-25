import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

type TemplateCopyToTeamDialogProps = {
  envelopeId: string;
  trigger?: React.ReactNode;
};

export const TemplateCopyToTeamDialog = ({ envelopeId, trigger }: TemplateCopyToTeamDialogProps) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const { toast } = useToast();
  const { t } = useLingui();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const eligibleTeams = useMemo(
    () => organisation.teams.filter((organisationTeam) => organisationTeam.id !== team.id),
    [organisation.teams, team.id],
  );

  const ZCopyToTeamFormSchema = z.object({
    targetTeamId: z
      .number({
        required_error: t`Select a team`,
        invalid_type_error: t`Select a team`,
      })
      .int()
      .positive(),
  });

  const form = useForm<z.infer<typeof ZCopyToTeamFormSchema>>({
    resolver: zodResolver(ZCopyToTeamFormSchema),
    defaultValues: {
      targetTeamId: undefined,
    },
  });

  const selectedTeamId = form.watch('targetTeamId');

  const selectedTeam = useMemo(
    () => eligibleTeams.find((eligibleTeam) => eligibleTeam.id === selectedTeamId),
    [eligibleTeams, selectedTeamId],
  );

  const { mutateAsync: copyTemplateToTeam, isPending: isCopying } = trpc.envelope.copyToTeam.useMutation();

  const onSubmit = async (data: z.infer<typeof ZCopyToTeamFormSchema>) => {
    const destinationTeam = eligibleTeams.find((eligibleTeam) => eligibleTeam.id === data.targetTeamId);

    if (!destinationTeam) {
      return;
    }

    try {
      const { id } = await copyTemplateToTeam({
        envelopeId,
        targetTeamId: data.targetTeamId,
        includeRecipients: true,
        includeFields: true,
        includeContents: true,
      });

      toast({
        title: t`Template copied`,
        description: t`A copy was created on ${destinationTeam.name}.`,
        duration: 5000,
      });

      const destinationPath = formatTemplatesPath(destinationTeam.url);

      await navigate(`${destinationPath}/${id}/edit`);
      setOpen(false);
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`This template could not be copied at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const hasEligibleTeams = eligibleTeams.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (isCopying) {
          return;
        }

        setOpen(value);

        if (!value) {
          form.reset();
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent data-testid="template-copy-to-team-dialog">
        <DialogHeader>
          <DialogTitle>
            <Trans>Copy to team</Trans>
          </DialogTitle>
          <DialogDescription>
            {hasEligibleTeams ? (
              <Trans>Creates a copy on the selected team. The original template is unchanged.</Trans>
            ) : (
              <Trans>No other teams in this organisation are available.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="space-y-4" disabled={isCopying || !hasEligibleTeams}>
              {hasEligibleTeams && (
                <FormField
                  control={form.control}
                  name="targetTeamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Destination team</Trans>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() ?? ''}
                          onValueChange={(value) => field.onChange(Number(value))}
                        >
                          <SelectTrigger data-testid="template-copy-to-team-select">
                            <SelectValue placeholder={t`Select a team`} />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleTeams.map((eligibleTeam) => (
                              <SelectItem key={eligibleTeam.id} value={eligibleTeam.id.toString()}>
                                {eligibleTeam.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isCopying}>
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button
                  type="submit"
                  loading={isCopying}
                  disabled={!hasEligibleTeams || !selectedTeam}
                  data-testid="template-copy-to-team-submit"
                >
                  {selectedTeam ? <Trans>Copy to {selectedTeam.name}</Trans> : <Trans>Copy to team</Trans>}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
