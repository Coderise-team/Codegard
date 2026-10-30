"""Dev-only email backend that prints messages the way a person reads them."""

from django.core.mail.backends.console import EmailBackend


class ReadableConsoleBackend(EmailBackend):
    """Console backend that prints the plain body as written.

    Django's own console backend prints the raw MIME message, and Django
    encodes any body with a line over 78 characters as quoted-printable. Every
    link in an account email is longer than that, so in the log it came out cut
    in half with ``=3D`` in place of each ``=`` — not something that can be
    copied into a browser, which is the whole point of printing it locally.
    Real mail is unaffected: mail clients decode it.
    """

    def write_message(self, message):
        self.stream.write(
            f"Subject: {message.subject}\n"
            f"From: {message.from_email}\n"
            f"To: {', '.join(message.to)}\n"
            "\n"
            f"{message.body}\n"
        )
        self.stream.write("-" * 79)
        self.stream.write("\n")
