<script lang="ts">
  let { onpick }: { onpick: (slots: number) => void } = $props();
  const options = [2, 3, 4, 5, 6, 8];
</script>

<div class="setup">
  <h1>Pit Planner</h1>
  <p class="muted">How many ball slots do you have this run?</p>
  <div class="opts">
    {#each options as n (n)}
      <button class:primary={n === 4} onclick={() => onpick(n)}>{n}</button>
    {/each}
  </div>
  <p class="muted small">Most characters have 4. The Hoary Hoarder has 2, the Ballbearer 8.</p>
</div>

<style>
  .setup { max-width: 420px; margin: 18vh auto 0; padding: 0 16px; text-align: center; display: grid; gap: 14px; }
  .opts { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
  .opts button { width: 56px; height: 56px; font-size: 20px; font-weight: 700; }
  .small { font-size: 13px; }
</style>
