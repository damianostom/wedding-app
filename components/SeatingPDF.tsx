import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export function SeatingPDF({ tables }: { tables: { name: string; guests: string[] }[] }) {
  const styles = StyleSheet.create({
    page: { padding: 24, fontSize: 12 },
    table: { marginBottom: 16 },
    title: { fontSize: 16, marginBottom: 8, fontWeight: 'bold' },
    item: { marginBottom: 2 },
  })
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {tables.map((t, i) => (
          <View key={i} style={styles.table}>
            <Text style={styles.title}>Stół: {t.name}</Text>
            {t.guests.map((g, j) => <Text key={j} style={styles.item}>• {g}</Text>)}
          </View>
        ))}
      </Page>
    </Document>
  )
}
