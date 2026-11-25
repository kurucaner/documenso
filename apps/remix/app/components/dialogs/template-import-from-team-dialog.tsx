import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
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
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useCurrentTeam } from '~/providers/team';

type TemplateImportFromTeamDialogProps = {
  trigger?: React.ReactNode;
};

type ImportWizardStep = 'sourceTeam' | 'pickTemplate' | 'confirm';

export const TemplateImportFromTeamDialog = ({ trigger }: TemplateImportFromTeamDialogProps) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportWizardStep>('sourceTeam');
  const [templateSearch, setTemplateSearch] = useState('');
  const debouncedTemplateSearch = useDebouncedValue(templateSearch, 400);

  const { toast } = useToast();
  const { t } = useLingui();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();
  const trpcUtils = trpc.useUtils();

  const sourceTeams = useMemo(
    () => organisation.teams.filter((organisationTeam) => organisationTeam.id !== team.id),
    [organisation.teams, team.id],
  );

  const ZSourceTeamSchema = z.object({
    sourceTeamId: z
      .number({
        required_error: t`Select a team`,
        invalid_type_error: t`Select a team`,
      })
      .int()
      .positive(),
  });

  const sourceTeamForm = useForm<z.infer<typeof ZSourceTeamSchema>>({
    resolver: zodResolver(ZSourceTeamSchema),
    defaultValues: {
      sourceTeamId: undefined,
    },
  });

  const sourceTeamId = sourceTeamForm.watch('sourceTeamId');
  const selectedSourceTeam = sourceTeams.find((sourceTeam) => sourceTeam.id === sourceTeamId);

  const [selectedTemplate, setSelectedTemplate] = useState<{
    envelopeId: string;
    title: string;
  } | null>(null);

  const importableTemplatesQuery = trpc.template.findImportableTemplates.useQuery(
    {
      sourceTeamId: sourceTeamId ?? 0,
      page: 1,
      perPage: 25,
      query: debouncedTemplateSearch || undefined,
    },
    {
      enabled: open && step !== 'sourceTeam' && typeof sourceTeamId === 'number' && sourceTeamId > 0,
    },
  );

  const { mutateAsync: copyTemplateToTeam, isPending: isImporting } = trpc.envelope.copyToTeam.useMutation();

  const resetWizard = () => {
    setStep('sourceTeam');
    setTemplateSearch('');
    setSelectedTemplate(null);
    sourceTeamForm.reset();
  };

  const onConfirmImport = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      const { id } = await copyTemplateToTeam({
        envelopeId: selectedTemplate.envelopeId,
        targetTeamId: team.id,
        includeRecipients: true,
        includeFields: true,
        includeContents: true,
      });

      await Promise.all([
        trpcUtils.template.findTemplatesInternal.invalidate(),
        trpcUtils.template.findTemplates.invalidate(),
      ]);

      toast({
        title: t`Template imported`,
        description: t`"${selectedTemplate.title}" was copied to ${team.name}.`,
        duration: 5000,
      });

      const templatePath = formatTemplatesPath(team.url);

      await navigate(`${templatePath}/${id}/edit`);
      setOpen(false);
      resetWizard();
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`This template could not be imported at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const hasSourceTeams = sourceTeams.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (isImporting) {
          return;
        }

        setOpen(value);

        if (!value) {
          resetWizard();
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent data-testid="template-import-from-team-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Import from team</Trans>
          </DialogTitle>
          <DialogDescription>
            {match(step)
              .with('sourceTeam', () =>
                hasSourceTeams ? (
                  <Trans>Choose a team, then pick a template to copy into this team.</Trans>
                ) : (
                  <Trans>No other teams in this organisation are available.</Trans>
                ),
              )
              .with('pickTemplate', () => (
                <Trans>Templates you can copy from {selectedSourceTeam?.name ?? t`the selected team`}.</Trans>
              ))
              .with('confirm', () => (
                <Trans>A copy will be created on {team.name}. The original template is unchanged.</Trans>
              ))
              .exhaustive()}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={isImporting} className="space-y-4">
          {step === 'sourceTeam' && (
            <Form {...sourceTeamForm}>
              <form
                className="space-y-4"
                onSubmit={sourceTeamForm.handleSubmit(() => {
                  setStep('pickTemplate');
                })}
              >
                {hasSourceTeams && (
                  <FormField
                    control={sourceTeamForm.control}
                    name="sourceTeamId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Source team</Trans>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value?.toString() ?? ''}
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <SelectTrigger data-testid="template-import-source-team-select">
                              <SelectValue placeholder={t`Select a team`} />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceTeams.map((sourceTeam) => (
                                <SelectItem key={sourceTeam.id} value={sourceTeam.id.toString()}>
                                  {sourceTeam.name}
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
                    <Button type="button" variant="secondary">
                      <Trans>Cancel</Trans>
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={!hasSourceTeams || !selectedSourceTeam}
                    data-testid="template-import-next"
                  >
                    <Trans>Next</Trans>
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {step === 'pickTemplate' && (
            <div className="space-y-4">
              <Input
                type="search"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder={t`Search templates...`}
                data-testid="template-import-search"
              />

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                {importableTemplatesQuery.isLoading && (
                  <p className="text-muted-foreground text-sm">
                    <Trans>Loading templates…</Trans>
                  </p>
                )}

                {!importableTemplatesQuery.isLoading && (importableTemplatesQuery.data?.data.length ?? 0) === 0 && (
                  <p className="text-muted-foreground text-sm">
                    <Trans>No templates found on this team.</Trans>
                  </p>
                )}

                {importableTemplatesQuery.data?.data.map((importableTemplate) => (
                  <button
                    key={importableTemplate.envelopeId}
                    type="button"
                    data-testid={`template-import-row-${importableTemplate.envelopeId}`}
                    className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      selectedTemplate?.envelopeId === importableTemplate.envelopeId ? 'bg-accent' : ''
                    }`}
                    onClick={() =>
                      setSelectedTemplate({
                        envelopeId: importableTemplate.envelopeId,
                        title: importableTemplate.title,
                      })
                    }
                  >
                    {importableTemplate.title}
                  </button>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setStep('sourceTeam')}>
                  <Trans>Back</Trans>
                </Button>
                <Button
                  type="button"
                  disabled={!selectedTemplate}
                  data-testid="template-import-continue"
                  onClick={() => setStep('confirm')}
                >
                  <Trans>Continue</Trans>
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'confirm' && selectedTemplate && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{selectedTemplate.title}</p>
                <p className="text-muted-foreground">
                  <Trans>From {selectedSourceTeam?.name ?? t`source team`}</Trans>
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setStep('pickTemplate')}>
                  <Trans>Back</Trans>
                </Button>
                <Button
                  type="button"
                  loading={isImporting}
                  data-testid="template-import-submit"
                  onClick={() => void onConfirmImport()}
                >
                  <Trans>Import to {team.name}</Trans>
                </Button>
              </DialogFooter>
            </div>
          )}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
