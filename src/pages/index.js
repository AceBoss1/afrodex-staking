import Head from 'next/head';
import AfrodexStaking from '../components/AfrodexStaking';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Afrodex Staking Platform</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Welcome to Afrodex</h1>
        <AfrodexStaking />
      </main>
    </div>
  );
}
