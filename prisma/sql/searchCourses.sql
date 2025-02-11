-- @param {String} $1:query The query to search with
-- @param {String} $2:termId TermId to limit searches to
-- @param {Int} $3:offset The offset for the results
-- @param {Int} $4:limit Number of results to limit to
-- @param {Int} $7:minRange
-- @param {Int} $8:maxRange
with ranked_courses as ( select c.id,
                                ts_rank(search, websearch_to_tsquery('simple', $1)) as tsrank,
                                SIMILARITY($1, c.name)                              as simname
                         from courses c
                                  join sections s on c.id = s.class_hash
                         where term_id = $2
                           and (cardinality($5::text[]) = 0 or subject = any ($5))
                           and (cardinality($6::text[]) = 0 or nupath @> $6)
                           and ($7 = -1 or $8 = -1 or (class_id::int > $7 and class_id::int < $8))
                           and (cardinality($9::text[]) = 0 or s.campus = any ($9))
                           and (not $10 or s.honors)
                           and (cardinality($11::text[]) = 0 or s.class_type = any ($11))
                           and ($4 > 0)
                         group by c.id, tsrank, simname )
select id
from ranked_courses
order by (0.7 * tsrank + 0.3 * simname) desc
offset $3;


