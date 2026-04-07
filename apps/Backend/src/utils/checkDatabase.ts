import { prisma } from "../config/database";

async function checkDatabase() {
  console.log("🔍 Checking database connection and API key...\n");

  try {
    // Test database connection
    await prisma.$connect();
    console.log("✅ Database connection successful\n");

    // Check if the API key exists
    const apiKeyFromEnv = "94b9314d3a75456eb495bb3a0e76ef8d47195cdfeb8e9d88b2ac4d6dd623e703";
    
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKeyFromEnv },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
    });

    if (keyRecord) {
      console.log("✅ API Key found in database:");
      console.log("   - Key:", keyRecord.key);
      console.log("   - Project:", keyRecord.project.name);
      console.log("   - Project ID:", keyRecord.projectId);
      console.log("   - Is Active:", keyRecord.isActive);
    } else {
      console.log("❌ API Key NOT found in database");
      console.log("   Please create a project and use that API key\n");
    }

    // Check services
    const services = await prisma.service.findMany();
    console.log(`\n📊 Services in database: ${services.length}`);
    services.forEach((s) => {
      console.log(`   - ${s.name} (Project: ${s.projectId})`);
    });

    // Check metrics count
    const requestCount = await prisma.requestMetric.count();
    const systemCount = await prisma.systemMetric.count();
    console.log(`\n📈 Metrics in database:`);
    console.log(`   - Request metrics: ${requestCount}`);
    console.log(`   - System metrics: ${systemCount}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
