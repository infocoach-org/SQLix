// select * from d
// inner join a on a.a = d.a and d.b = 0 and b.a > 0
// inner join b on b.a = d.a

// not possible because in the inner join of a, b is mentioned, which is not possible

// select count(*) as abcdef from d
// where abcdef > 0 => not possible (abcdef can only be referenced in having)

// https://dba.stackexchange.com/a/225883 => select columns dürfen nur in
