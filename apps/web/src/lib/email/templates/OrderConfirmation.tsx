import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface OrderItem {
  itemName: string;
  variantLabel: string;
  qty: number;
  unitPrice: number;
}

interface OrderConfirmationEmailProps {
  tenantName: string;
  tenantAccent: string;
  orderId: string;
  parentName: string;
  studentName: string;
  studentYear: string;
  items: OrderItem[];
  totalAmount: number;
  refundPolicyUrl: string;
}

export const OrderConfirmationEmail = ({
  tenantName = "School Shop",
  tenantAccent = "#000000",
  orderId = "ORD-123",
  parentName = "Parent",
  studentName = "Student",
  studentYear = "Year 1",
  items = [],
  totalAmount = 0,
  refundPolicyUrl = "#",
}: OrderConfirmationEmailProps) => {
  const previewText = `Order Confirmation ${orderId} - ${tenantName}`;

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
            <Heading style={h1}>Order Confirmed</Heading>
            <Text style={text}>Hi {parentName},</Text>
            <Text style={text}>
              Thank you for your order! We've received your order{" "}
              <strong>#{orderId}</strong> for <strong>{studentName}</strong> ({studentYear}).
            </Text>
            <Text style={text}>
              You will receive another email when your items are ready for collection.
            </Text>

            <Section style={itemSection}>
              <Row style={itemHeaderRow}>
                <Column style={itemHeaderCol}>Item</Column>
                <Column style={{ ...itemHeaderCol, textAlign: "center" }}>Qty</Column>
                <Column style={{ ...itemHeaderCol, textAlign: "right" }}>Total</Column>
              </Row>
              <Hr style={hr} />
              {items.map((item, index) => (
                <Row key={index} style={itemRow}>
                  <Column style={itemCol}>
                    <Text style={itemNameText}>{item.itemName}</Text>
                    <Text style={variantText}>{item.variantLabel}</Text>
                  </Column>
                  <Column style={{ ...itemCol, textAlign: "center" }}>
                    {item.qty}
                  </Column>
                  <Column style={{ ...itemCol, textAlign: "right" }}>
                    ${(item.unitPrice * item.qty).toFixed(2)}
                  </Column>
                </Row>
              ))}
              <Hr style={hr} />
              <Row style={totalRow}>
                <Column style={{ width: "80%" }}>
                  <Text style={totalLabel}>Total</Text>
                </Column>
                <Column style={{ width: "20%", textAlign: "right" }}>
                  <Text style={totalAmountText}>${totalAmount.toFixed(2)}</Text>
                </Column>
              </Row>
            </Section>

            <Text style={footerText}>
              Please review our{" "}
              <Link href={refundPolicyUrl} style={link}>
                Refund Policy
              </Link>{" "}
              if you have any questions.
            </Text>
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

export default OrderConfirmationEmail;

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

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const itemSection = {
  marginTop: "32px",
  marginBottom: "32px",
};

const itemHeaderRow = {
  paddingBottom: "8px",
};

const itemHeaderCol = {
  color: "#8898aa",
  fontSize: "12px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
};

const itemRow = {
  padding: "12px 0",
};

const itemCol = {
  fontSize: "14px",
  color: "#525f7f",
};

const itemNameText = {
  margin: "0",
  fontWeight: "bold",
};

const variantText = {
  margin: "0",
  fontSize: "12px",
  color: "#8898aa",
};

const totalRow = {
  marginTop: "16px",
};

const totalLabel = {
  fontSize: "16px",
  fontWeight: "bold",
  color: "#333",
  margin: "0",
};

const totalAmountText = {
  fontSize: "18px",
  fontWeight: "bold",
  color: "#333",
  margin: "0",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "12px 0",
};

const footerHr = {
  borderColor: "#e6ebf1",
  margin: "0",
};

const footer = {
  padding: "32px 48px",
};

const footerText = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "22px",
  marginTop: "32px",
};

const footerNote = {
  color: "#8898aa",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0",
};

const link = {
  color: "#556cd6",
  textDecoration: "underline",
};
