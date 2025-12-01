-- Add DELETE policy for exports table
CREATE POLICY "Users can delete their own exports"
ON public.exports
FOR DELETE
USING (auth.uid() = user_id);