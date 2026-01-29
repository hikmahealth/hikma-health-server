CREATE OR REPLACE FUNCTION is_valid_json(p_json text) RETURNS boolean AS $$
BEGIN
  -- Attempt to cast the input text to json
  RETURN (p_json::json IS NOT NULL);
EXCEPTION
  WHEN others THEN
    -- If an error (e.g., invalid_text_representation) occurs during casting, it's not valid JSON
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION try_cast_to_float(input_string text) RETURNS float AS $$
BEGIN
    -- Attempt to cast the input string to a float
    RETURN input_string::float;
EXCEPTION
    -- If an exception (error) occurs during the cast, return NULL
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION try_cast_to_boolean(input_string text) RETURNS boolean AS $$
BEGIN
    -- Attempt to cast the input string to a float
    RETURN input_string::boolean;
EXCEPTION
    -- If an exception (error) occurs during the cast, return NULL
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION try_cast_to_timestamptz(input_string text) RETURNS timestamptz AS $$
BEGIN
    -- Attempt to cast the input string to a float
    RETURN input_string::timestamptz;
EXCEPTION
    -- If an exception (error) occurs during the cast, return NULL
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
