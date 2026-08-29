pwd

read -d '\n' QUERY << END
SELECT title,round(cost,2) as cost,
       tokens_input, tokens_output, tokens_reasoning,
       tokens_cache_read, tokens_cache_write,
       time_created, 
       time_updated
FROM session
WHERE (
  (
  parent_id IS NULL AND directory = "$(pwd)"
  ) OR
  (
parent_id IN (SELECT id FROM SESSION WHERE directory = "$(pwd)")
  )
  )
  AND (cost > 0 OR tokens_input > 0 OR tokens_output > 0)
ORDER BY time_updated ASC;
END

sqlite3 ~/.local/share/opencode/opencode.db ".output session-cost.csv" "$QUERY" -csv -header

read -d '\n' SUMQUERY << END
SELECT "Total",round(sum(cost),2) as cost,
       sum(tokens_input), sum(tokens_output), sum(tokens_reasoning),
       sum(tokens_cache_read), sum(tokens_cache_write),
       min(time_created),max(time_updated)
FROM session
WHERE (
  (
  parent_id IS NULL AND directory = "$(pwd)"
  ) OR
  (
parent_id IN (SELECT id FROM SESSION WHERE directory = "$(pwd)")
  )
  )
  AND (cost > 0 OR tokens_input > 0 OR tokens_output > 0);
END

sqlite3 ~/.local/share/opencode/opencode.db "$SUMQUERY" -csv >> session-cost.csv

