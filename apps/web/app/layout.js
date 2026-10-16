import './globals.css';

export const metadata = {
  title: 'AccessMap',
  description: 'Community-verified accessibility information for public spaces.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Browser extensions may add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
