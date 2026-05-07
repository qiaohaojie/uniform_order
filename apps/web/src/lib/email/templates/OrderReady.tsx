import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface OrderReadyEmailProps {
  tenantName: string;
  tenantAccent: string;
  orderId: string;
  studentName: string;
  collectionInstructions: string;
  shopHours: string;
  orderUrl: string;
}

export const OrderReadyEmail = ({
  tenantName = "School Shop",
  tenantAccent = "#000000",
  orderId = "ORD-123",
  studentName = "Student",
  collectionInstructions = "Please collect from the school office.",
  shopHours = "Mon-Fri, 8:30am - 4:00pm",
  orderUrl = "#",
}: OrderReadyEmailProps) => {
  const previewText = `Your order ${orderId} is ready for pickup!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...header, backgroundColor: tenantAccent }}>
            <Heading style={headerTitle}>{tenantName}</Heading>
          </Section>
          <Section style={content}>
            <Heading style={h1}>Ready for Pickup</Heading>
            <Text style={text}>Great news!</Text>
            <Text style={text}>
              Your order <strong>#{orderId}</strong> for <strong>{studentName}</strong> is now ready for collection.
            </Text>

            <Section style={infoSection}>
              <Heading style={h2}>Collection Instructions</Heading>
              <Text style={infoText}>{collectionInstructions}</Text>
              
              <Heading style={h2}>Shop Hours</Heading>
              <Text style={infoText}>{shopHours}</Text>
            </Section>

            <Text style={text}>
              Please bring a copy of this email or your order number when you come to collect.
            </Text>
            <Section style={ctaSection}>
              <Link href={orderUrl} style={{ ...ctaButton, backgroundColor: tenantAccent }}>
                View order status
              </Link>
            </Section>
          </Section>
          <Hr style={footerHr} />
          <Section style={footer}>
            <Text style={footerNote}>
              &copy; {new Date().getFullYear()} {tenantName}. Powered by Uniform Order.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default OrderReadyEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  marginBottom: "64px",
};

const header = {
  padding: "32px",
  textAlign: "center" as const,
};

const headerTitle = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0",
};

const content = {
  padding: "40px 48px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 20px",
};

const h2 = {
  color: "#333",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "24px 0 8px",
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const infoSection = {
  backgroundColor: "#f9fafb",
  padding: "20px",
  borderRadius: "4px",
  marginTop: "24px",
  marginBottom: "24px",
};

const infoText = {
  color: "#525f7f",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
};

const footerHr = {
  borderColor: "#e6ebf1",
  margin: "0",
};

const footer = {
  padding: "32px 48px",
};

const footerNote = {
  color: "#8898aa",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0",
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0 8px",
};

const ctaButton = {
  display: "inline-block",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "6px",
};
