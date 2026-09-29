import { ErrorView } from '@/components/error-view';

export default function NotFound() {
  return (
    <ErrorView
      eyebrow="404 · Offside"
      title="This page is out of play"
      message="The link you followed doesn’t lead anywhere. Let’s get you back on the pitch."
      homeHref="/"
      homeLabel="Back to kick-off"
    />
  );
}
