<script lang="ts">
  import type { Assertion, AssertionType, AssertionOperator, ScriptsConfig } from '../../lib/types'

  interface Props {
    scripts: ScriptsConfig
    onchange: (scripts: ScriptsConfig) => void
  }

  let { scripts, onchange }: Props = $props()

  let assertions = $derived(scripts.assertions ?? [])
  let hasAssertions = $derived(assertions.length > 0)

  const typeLabels: Record<AssertionType, string> = {
    status: 'Status',
    header: 'Header',
    json_path: 'JSON Path',
    response_time: 'Response Time',
  }

  const operatorLabels: Record<AssertionOperator, string> = {
    equals: 'equals',
    not_equals: 'not equals',
    contains: 'contains',
    not_contains: 'not contains',
    exists: 'exists',
    not_exists: 'not exists',
    less_than: 'less than',
    greater_than: 'greater than',
    matches_regex: 'matches regex',
  }

  const numericOperators: AssertionOperator[] = ['equals', 'not_equals', 'less_than', 'greater_than']
  const allOperators: AssertionOperator[] = [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'exists',
    'not_exists',
    'less_than',
    'greater_than',
    'matches_regex',
  ]

  function operatorsForType(type: AssertionType): AssertionOperator[] {
    if (type === 'status' || type === 'response_time') return numericOperators
    return allOperators
  }

  function emitChange(updated: Assertion[]): void {
    onchange({ ...scripts, assertions: updated.length > 0 ? updated : undefined })
  }

  function addAssertion(): void {
    const updated = [...assertions, { type: 'status' as AssertionType, target: '', operator: 'equals' as AssertionOperator, expected: '200', enabled: true }]
    emitChange(updated)
  }

  function updateAssertion(index: number, field: keyof Assertion, value: string | boolean): void {
    const updated = [...assertions]
    updated[index] = { ...updated[index], [field]: value }

    // When type changes, clear target for types that don't need it
    if (field === 'type') {
      const newType = value as AssertionType
      if (newType === 'status' || newType === 'response_time') {
        updated[index].target = ''
      }
      // Reset operator if it's not valid for the new type
      const validOps = operatorsForType(newType)
      if (!validOps.includes(updated[index].operator)) {
        updated[index].operator = 'equals'
      }
    }

    // When operator changes, check it's valid for the current type
    if (field === 'operator') {
      const validOps = operatorsForType(updated[index].type)
      if (!validOps.includes(value as AssertionOperator)) {
        updated[index].operator = 'equals'
      }
    }

    emitChange(updated)
  }

  function removeAssertion(index: number): void {
    const updated = assertions.filter((_, i) => i !== index)
    emitChange(updated)
  }

  function toggleAssertion(index: number): void {
    const updated = [...assertions]
    updated[index] = { ...updated[index], enabled: !updated[index].enabled }
    emitChange(updated)
  }

  function needsTarget(type: AssertionType): boolean {
    return type === 'header' || type === 'json_path'
  }

  function hidesExpected(operator: AssertionOperator): boolean {
    return operator === 'exists' || operator === 'not_exists'
  }
</script>

<div class="p-3 flex flex-col gap-5">
  <section>
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-xs font-medium text-surface-300 m-0">Assertions</h3>
      <button
        onclick={addAssertion}
        class="border-none bg-transparent text-brand-400 text-xs font-sans cursor-pointer p-0 transition-colors duration-[0.12s] hover:text-brand-300"
      >
        + Add
      </button>
    </div>

    {#if hasAssertions}
      <div class="flex flex-col gap-1.5">
        {#each assertions as assertion, i (i)}
          <div class="p-2.5 rounded-md border border-surface-700 bg-surface-800/50 flex items-start gap-2">
            <!-- Toggle checkbox -->
            <label class="flex items-center justify-center shrink-0 mt-[7px] cursor-pointer">
              <input
                type="checkbox"
                checked={assertion.enabled}
                onchange={() => toggleAssertion(i)}
                class="te-checkbox"
              />
            </label>

            <!-- Fields -->
            <div class="flex-1 min-w-0 flex flex-col gap-1.5" class:opacity-40={!assertion.enabled}>
              <div class="flex gap-1.5">
                <!-- Type selector -->
                <select
                  value={assertion.type}
                  onchange={(e) => updateAssertion(i, 'type', e.currentTarget.value)}
                  class="te-select w-[120px] shrink-0"
                >
                  {#each Object.entries(typeLabels) as [value, label] (value)}
                    <option {value}>{label}</option>
                  {/each}
                </select>

                <!-- Target input (only for header and json_path) -->
                {#if needsTarget(assertion.type)}
                  <input
                    type="text"
                    value={assertion.target}
                    oninput={(e) => updateAssertion(i, 'target', e.currentTarget.value)}
                    placeholder={assertion.type === 'header' ? 'Header-Name' : 'data.items[0].id'}
                    class="h-[30px] flex-1 min-w-0 px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                  />
                {/if}
              </div>

              <div class="flex gap-1.5">
                <!-- Operator selector -->
                <select
                  value={assertion.operator}
                  onchange={(e) => updateAssertion(i, 'operator', e.currentTarget.value)}
                  class="te-select w-[120px] shrink-0"
                >
                  {#each operatorsForType(assertion.type) as op (op)}
                    <option value={op}>{operatorLabels[op]}</option>
                  {/each}
                </select>

                <!-- Expected value (hidden for exists/not_exists) -->
                {#if !hidesExpected(assertion.operator)}
                  <input
                    type="text"
                    value={assertion.expected}
                    oninput={(e) => updateAssertion(i, 'expected', e.currentTarget.value)}
                    placeholder="Expected value"
                    class="h-[30px] flex-1 min-w-0 px-2 border border-transparent rounded-sm bg-surface-800 text-surface-200 text-xs font-sans outline-none transition-[border-color] duration-[0.12s] focus:border-brand-500 placeholder:text-surface-600"
                  />
                {/if}
              </div>
            </div>

            <!-- Remove button -->
            <button
              onclick={() => removeAssertion(i)}
              class="flex items-center justify-center w-[26px] h-[26px] shrink-0 mt-[5px] border-none rounded-sm bg-transparent text-surface-500 cursor-pointer transition-[color,background] duration-100 hover:text-danger-light hover:bg-danger-light/[0.08]"
              title="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-[11px] text-surface-500 m-0 leading-relaxed">
        Add assertions to automatically verify response properties.
      </p>
    {/if}
  </section>
</div>

<style>
  .te-checkbox {
    appearance: none;
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--color-surface-500);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
    position: relative;
    transition: border-color 0.12s, background-color 0.12s;
  }

  .te-checkbox:checked {
    border-color: var(--color-brand-400);
    background-color: var(--color-brand-400);
  }

  .te-checkbox:checked::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 4px;
    width: 4px;
    height: 7px;
    border: solid var(--color-surface-900);
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }

  .te-select {
    height: 30px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: var(--color-surface-800);
    color: var(--color-surface-200);
    font-size: calc(12px + var(--ui-bump));
    font-family: inherit;
    outline: none;
    appearance: none;
    cursor: pointer;
    transition: border-color 0.12s;
  }

  .te-select:focus {
    border-color: var(--color-brand-500);
  }
</style>
