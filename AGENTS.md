<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `ai` and `@ai-sdk/openai` pinned to compatible releases using the same provider contract, so server model and tool types remain compatible.
- Route dashboard dictation and typed copilot requests through the same owner-scoped tool conversation; execute mutations only through the audited transaction and render its actual outcome, so voice and text cannot diverge.
- Keep speech synthesis server-side and stream PCM to the browser; keep assistant activity append-only, owner-readable and transactionally linked to operations, so recorded success is inseparable from the committed change.
