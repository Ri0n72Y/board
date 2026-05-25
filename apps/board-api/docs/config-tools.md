# Board Config Tools

## cleanExcludeTags

`cleanExcludeTags(config)` is a manual maintenance helper for board config.

It removes entries from `snapshot.excludeTags` when the tag is not present in
the configured tag definitions. The loader does not run this automatically:
snapshot filtering can be project-specific, and validating every excluded tag
during startup would add unnecessary coupling between config loading and board
projection policy.

Current intended use:

- run manually from a maintenance script or future admin-only command;
- inspect the result before writing it back to yaml;
- keep yaml as the backup/export format until pid/config state is moved to
  Redis or another runtime state store.

This helper does not edit the yaml file by itself.
