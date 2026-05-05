export interface ParsedAcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
}

export interface ParsedKSpecDraft {
  title: string;
  type: string;
  description: string;
  maturity: string;
  acceptance_criteria: ParsedAcceptanceCriterion[];
}

export function parseKSpec(yaml: string): ParsedKSpecDraft {
  const lines = yaml.split('\n');
  const getValue = (key: string) =>
    lines
      .find((l) => l.startsWith(`${key}:`))
      ?.split(':')[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, '') || '';

  const acs: ParsedAcceptanceCriterion[] = [];
  let currentAc: ParsedAcceptanceCriterion | null = null;
  let currentField: keyof ParsedAcceptanceCriterion | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('- id:')) {
      if (currentAc) acs.push(currentAc);
      currentAc = {
        id: trimmed.split(':')[1]?.trim() || '',
        given: '',
        when: '',
        // biome-ignore lint/suspicious/noThenProperty: KSpec acceptance criteria use the Given/When/Then contract.
        // biome-ignore lint/complexity/useLiteralKeys: Avoid noThenProperty while preserving KSpec field name.
        ['then']: '',
      };
      currentField = null;
    } else if (currentAc) {
      if (trimmed.startsWith('given:')) {
        currentField = 'given';
        currentAc.given = trimmed.includes('|')
          ? ''
          : trimmed.split(':')[1]?.trim() || '';
      } else if (trimmed.startsWith('when:')) {
        currentField = 'when';
        currentAc.when = trimmed.includes('|')
          ? ''
          : trimmed.split(':')[1]?.trim() || '';
      } else if (trimmed.startsWith('then:')) {
        currentField = 'then';
        // biome-ignore lint/complexity/useLiteralKeys: Avoid noThenProperty while preserving KSpec field name.
        currentAc['then'] = trimmed.includes('|')
          ? ''
          : trimmed.split(':')[1]?.trim() || '';
      } else if (line.startsWith('      ') && currentField) {
        currentAc[currentField] +=
          (currentAc[currentField] ? '\n' : '') + line.substring(6);
      }
    }
  }
  if (currentAc) acs.push(currentAc);

  return {
    title: getValue('title'),
    type: getValue('type'),
    description:
      yaml.match(/description: >-\s+([\s\S]*?)(?=\n\S|$)/)?.[1]?.trim() || '',
    maturity: yaml.match(/maturity:\s+(\S+)/)?.[1] || 'draft',
    acceptance_criteria: acs,
  };
}

export function toYaml(data: ParsedKSpecDraft): string {
  let yaml = `title: ${data.title}\ntype: ${data.type}\nstatus:\n  maturity: ${data.maturity}\ndescription: >-\n  ${data.description.replace(/\n/g, '\n  ')}\nacceptance_criteria:\n`;
  data.acceptance_criteria.forEach((ac) => {
    yaml += `  - id: ${ac.id}\n`;
    yaml += `    given: |\n      ${ac.given.replace(/\n/g, '\n      ')}\n`;
    yaml += `    when: |\n      ${ac.when.replace(/\n/g, '\n      ')}\n`;
    yaml += `    then: |\n      ${ac.then.replace(/\n/g, '\n      ')}\n`;
  });
  return yaml;
}

export function validateDraftContent(content: string): string[] {
  const trimmed = content.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push('Draft content is empty.');
  if (!/^title:\s+\S+/m.test(trimmed)) errors.push('Missing top-level title.');
  if (!/^type:\s+\S+/m.test(trimmed)) errors.push('Missing top-level type.');
  if (
    !/^status:\s*$/m.test(trimmed) &&
    !/^status:\s+\S+/m.test(trimmed) &&
    !/maturity:/m.test(trimmed)
  )
    errors.push('Missing status block.');
  if (!/acceptance_criteria:/m.test(trimmed))
    errors.push('Missing acceptance_criteria section.');
  return errors;
}
