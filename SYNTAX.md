# Allowed syntax for SQLix

## Identifiers

Identifiers are datatypes, table names, and column names.

Identifiers are case sensitive and can be marked surrounded by " or `.

They adhere to the following regex:

```
^([`"]?)(?!\d|-|_)[a-zA-Z0-9_-]+\1$
```

### Column and table names

Cannot be any data type or keyword. 

## Datatypes

SQLix has static types unlike sqlite,
this means that a column can have a type, and if it is set, only operators, functions and literals compatible with this type can be used on the column. However a column can also not be given a type, resulting in all values except null being stored and compared as strings. This type is referred to as ANY.

The data types are: 

- INT/INTEGER
- FLOAT/FLOAT
- TEXT
- BOOLEAN
- NULL
- ANY

Of these NULL and ANY cannot be used as a column data type, as NULL is used in combination with another type and ANY is given to a column as the default column type.

### Literals

| Data type | INT/INTEGER  | FLOAT  |  TEXT |  BOOLEAN |
|---|---|---|---|---|
| description | integer value from -2^53 to 2^53 – 1 | every number value that js can parse  | a string using single quotes ('), to the following characters have to be preceded with a backslash in order to be used: \, '. A new line is represented by \n. |  can be either true or false (no matter capitalization) |
| example | 34 | 34.0 or 34 or 0xff or 0.255e3  | 'I just love\n\'hey\''  | True |

## Keywords

Key words are case insensitive and only contain letters.

All existing keywords are:


## Statements 

### Generals

Squared brackets surrounding syntax makes it optional, braces along with the | character give multiple options, and the dollar sign identifies user input. All keywords are highlighted by color.

All column and table names cannot be any existing keywords or datatypes.

### Creating tables

```SQL
CREATE TABLE $table_name(
  $column_name [ $data_type ] [ PRIMARY KEY ]
    REFERENCES $other_table_name 
    [ ( $other_column_name, ... ) ]
  [ , ... ]
  [ 
    [ CONSTRAINT $constraint_name ] 
    { 
      PRIMARY KEY ($primary_column_name, ... ) |
      FOREIGN KEY ($primary_column_name, ... ) 
        REFERENCES $other_table_name 
        [ ( $other_column_name, ... ) ] 
    } 
  ]
  [ , ... ]
)

```

Notes:
- contraint names will be ignored and not saved in any metadata
- column or constaint declarations have to be seperated by line

### Inserting columns

```sql
INSERT INTO $table_name [ ( $column_name, ... ) ]
  VALUES ( $colum_literal, ... ), ...
```

### Selecting columns

```sql
SELECT [ DISTINCT ] { * | $expression [ AS $output_name ]}, ...
  FROM $from_item, ...
  [ [ { INNER | { LEFT | RIGHT } [ OUTER ] } ] JOIN $from_item ON $boolean_expression ], ...
  [ WHERE $boolean_condition ]
  [ GROUP BY $expression, ... ]
  [ HAVING $boolean_expression, ... ]
  [ UNION $select ] 
  [ ORDER BY $expression [ { ASC | DESC } ], ... ]
  [ LIMIT $count ]
  [ OFFSET $start ]
```

`$select` can be:
A select without `ORDER BY`, `LIMIT` and `OFFSET`

`$from_item` can be:
```sql
{
  $table_name [ .* ]
    [ [ AS ] $table_alias [ ( $column_alias_list ) ] ] |
  ( $select_statement ) [ AS ] $select_name [ ( $column_alias_list ) ]
}
```

### Operators

If any of the argument types is any, both will be compared as strings except the value null.

| Operator  |  Description| Before argument type  | Middle argument type | After argument type | Return type  | Note|
|---|---|---|---|---|---|---|
|  =, <>  | equal/unequal | *all*  | - | *all*  | `BOOLEAN`   | The data types need to be the same |
|  NOT | not/negation | - | `BOOLEAN`  | - | `BOOLEAN`   | - |
|  <, >, <=, >= | comparison operators | -  | - | `TEXT`, `INT`, `FLOAT` | `BOOLEAN`   | - |
|  IS [ NOT ] NULL | check if null | *all*  | - | - | `BOOLEAN`   | - |
|  +, -, \*, / | arithmetic operators | `INT`, `FLOAT`  | - | `INT`, `FLOAT` | `FLOAT` | - |
| OR, AND | Logical operators | `BOOLEAN`  | - | `BOOLEAN` | `BOOLEAN` | - |
| BETWEEN $middle_value AND | Number between two numbers | `INT`, `NUMBER`  | `INT`, `NUMBER` | `INT`, `NUMBER` | `BOOLEAN` | - |
| LIKE | `TEXT` | - | `TEXT` | `BOOLEAN` | - |
| IN | Is in any of the given rows | *any*, (*any*,... ) | - | Select with same amount of rows with same types or  | BOOLEAN | - |


### Aggregate functions
| Function name  | Description |
|---|---|
| min/max | Gives back the lowest or hightest non null value back, if all values are null, gives back |
| count  | With column counts all non null values, with * counts all rows. Allowed parameters: `column | *`, Not allowed: `column.*`   |
| avg/sum | Gives back given number type (no not null) (as double) |
