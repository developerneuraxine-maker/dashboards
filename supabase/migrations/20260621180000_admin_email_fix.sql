-- Update handle_new_user to always assign admin role to designated admin emails.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first        BOOLEAN;
  is_admin_email  BOOLEAN;
BEGIN
  -- Emails that always get admin role (add more as needed)
  is_admin_email := NEW.email IN ('socialsprouts1@gmail.com');

  SELECT COUNT(*) = 0 INTO is_first FROM public.profiles;

  INSERT INTO public.profiles (id, full_name, email, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF is_admin_email OR is_first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$$;
