<script lang="ts">
  import { toastsStore } from '../../lib/stores/toasts.svelte'
</script>

{#if toastsStore.toasts.length > 0}
  <div class="toast-stack">
    {#each toastsStore.toasts as toast (toast.id)}
      {@const cat = toast.category}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="toast"
        class:toast--vault={cat === 'vault'}
        class:toast--sync={cat === 'sync'}
        class:toast--update={cat === 'update'}
        onmouseenter={() => toastsStore.pauseToast(toast.id)}
        onmouseleave={() => toastsStore.resumeToast(toast.id)}
      >
        <!-- Liquid glass highlight layer -->
        <div class="toast-sheen"></div>

        <!-- Icon -->
        <div class="toast-icon" class:toast-icon--vault={cat === 'vault'} class:toast-icon--sync={cat === 'sync'} class:toast-icon--update={cat === 'update'}>
          {#if cat === 'vault'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          {:else if cat === 'update'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/><path d="M21 8A10 10 0 1 0 6.3 4.7L3 8"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
            </svg>
          {/if}
        </div>

        <!-- Content -->
        <div class="toast-body">
          <div class="toast-label" class:toast-label--vault={cat === 'vault'} class:toast-label--sync={cat === 'sync'} class:toast-label--update={cat === 'update'}>
            {cat === 'vault' ? 'Vault' : cat === 'update' ? 'Updates' : 'Git Sync'}
          </div>
          <div class="toast-message">{toast.message}</div>
        </div>

        <!-- Dismiss -->
        <button class="toast-dismiss" onclick={() => toastsStore.dismissToast(toast.id)} aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>

        <!-- Countdown bar -->
        <div class="toast-countdown-track">
          <div class="toast-countdown-bar" class:toast-countdown-bar--vault={cat === 'vault'} class:toast-countdown-bar--sync={cat === 'sync'} class:toast-countdown-bar--update={cat === 'update'}></div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    bottom: 48px;
    right: 14px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 370px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 14px 18px;
    border-radius: var(--radius-xl);
    overflow: hidden;

    /* Liquid glass surface */
    background:
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.06) 0%,
        rgba(255, 255, 255, 0.02) 40%,
        rgba(255, 255, 255, 0.04) 100%
      ),
      var(--glass-bg-heavy);
    backdrop-filter: blur(32px) saturate(1.4);
    -webkit-backdrop-filter: blur(32px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);

    animation: toast-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    transition: box-shadow 0.2s;
  }

  .toast:hover {
    box-shadow:
      0 16px 48px rgba(0, 0, 0, 0.35),
      0 4px 12px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  }

  /* Pause countdown animation on hover */
  .toast:hover .toast-countdown-bar {
    animation-play-state: paused;
  }

  .toast--vault {
    border-top-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  }
  .toast--sync {
    border-top-color: color-mix(in srgb, var(--color-purple) 25%, transparent);
  }
  .toast--update {
    border-top-color: color-mix(in srgb, var(--color-brand-400) 25%, transparent);
  }

  /* Specular highlight sweep — liquid refraction effect */
  .toast-sheen {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.04) 45%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.04) 55%,
      transparent 70%
    );
    pointer-events: none;
  }

  /* Icon container */
  .toast-icon {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    margin-top: 1px;
  }
  .toast-icon--vault {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-warning) 10%, transparent);
  }
  .toast-icon--sync {
    background: color-mix(in srgb, var(--color-purple) 15%, transparent);
    color: var(--color-purple);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-purple) 10%, transparent);
  }
  .toast-icon--update {
    background: color-mix(in srgb, var(--color-brand-400) 15%, transparent);
    color: var(--color-brand-400);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-brand-400) 10%, transparent);
  }

  /* Content */
  .toast-body {
    position: relative;
    flex: 1;
    min-width: 0;
    padding-top: 1px;
  }

  .toast-label {
    font-size: calc(12px + var(--ui-bump));
    font-weight: 600;
    letter-spacing: 0.01em;
    margin-bottom: 3px;
  }
  .toast-label--vault { color: var(--color-warning); }
  .toast-label--sync { color: var(--color-purple); }
  .toast-label--update { color: var(--color-brand-400); }

  .toast-message {
    font-size: calc(12.5px + var(--ui-bump));
    color: var(--color-surface-300);
    line-height: 1.45;
    word-break: break-word;
  }

  /* Dismiss button */
  .toast-dismiss {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--color-surface-500);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    margin-top: 1px;
  }
  .toast-dismiss:hover {
    color: var(--color-surface-200);
    background: var(--tint-active);
  }

  /* Countdown track + bar */
  .toast-countdown-track {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2.5px;
    background: rgba(255, 255, 255, 0.04);
  }

  .toast-countdown-bar {
    height: 100%;
    border-radius: 0 2px 0 0;
    animation: toast-countdown 8s linear forwards;
  }
  .toast-countdown-bar--vault {
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-warning) 60%, transparent), var(--color-warning));
  }
  .toast-countdown-bar--sync {
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-purple) 60%, transparent), var(--color-purple));
  }
  .toast-countdown-bar--update {
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-brand-400) 60%, transparent), var(--color-brand-400));
  }

  /* Animations */
  @keyframes toast-enter {
    0% {
      opacity: 0;
      transform: translateX(28px) scale(0.94);
    }
    100% {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes toast-countdown {
    from { width: 100%; }
    to { width: 0%; }
  }

  /* Light theme adjustments */
  :global(html.light) .toast {
    background:
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.7) 0%,
        rgba(255, 255, 255, 0.4) 40%,
        rgba(255, 255, 255, 0.5) 100%
      );
    border-color: rgba(0, 0, 0, 0.08);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.8),
      inset 0 -1px 0 rgba(0, 0, 0, 0.04);
  }
  :global(html.light) .toast-sheen {
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.5) 45%,
      rgba(255, 255, 255, 0.7) 50%,
      rgba(255, 255, 255, 0.5) 55%,
      transparent 70%
    );
  }
  :global(html.light) .toast-countdown-track {
    background: rgba(0, 0, 0, 0.06);
  }
</style>
