# Graph tools instructions

Use code-review-graph to build structural context before reading files. This prevents wasting tokens
on code you don't need and surfaces relationships that aren't obvious from file names alone.

## Available tools

| Tool                                      | Purpose                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build_or_update_graph_tool()`            | Incremental graph update to reflect current state. Run before querying if changes are recent.                                                           |
| `get_review_context_tool()`               | Returns changed files, impacted nodes, source snippets, and review guidance. Pass `base="main"` for branch/PR scope.                                    |
| `get_impact_radius_tool(target)`          | Returns blast radius: files and functions that depend on the target, with dependency counts.                                                            |
| `semantic_search_nodes_tool(query, kind)` | Find entities by name or keyword. Filter by `kind` (e.g., `"Test"`, `"Function"`, `"Class"`).                                                           |
| `query_graph_tool(pattern, target)`       | Explore relationships. Patterns: `tests_for`, `callers_of`, `callees_of`, `imports_of`, `importers_of`, `children_of`, `inheritors_of`, `file_summary`. |

## Fallback when graph is unavailable

If the graph returns 0 nodes, hasn't been built, or is genuinely unavailable:

- Dispatch `cape:codebase-investigator` to find file conventions, test mappings, and structural
  relationships manually
- Read files and diffs directly
- Don't block on the graph — proceed with reduced structural context
