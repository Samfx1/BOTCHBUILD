const { z } = require("zod");
const {
  createInvestmentSchema,
  listMyInvestmentsQuerySchema,
} = require("./investments.validation");

const investmentIdParamSchema = z.object({
  investmentId: z.string().uuid(),
});

function createInvestmentsController({ investmentsService }) {
  async function createInvestment(req, res) {
    const input = createInvestmentSchema.parse(req.body);
    const investment = await investmentsService.createInvestment({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      input,
    });
    return res.status(201).json(investment);
  }

  async function listMyInvestments(req, res) {
    const query = listMyInvestmentsQuerySchema.parse(req.query);
    const investments = await investmentsService.listMyInvestments({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      query,
    });
    return res.status(200).json({ investments });
  }

  async function getInvestmentById(req, res) {
    const params = investmentIdParamSchema.parse(req.params);
    const investment = await investmentsService.getInvestmentByIdForActor({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      investmentId: params.investmentId,
    });
    return res.status(200).json(investment);
  }

  return {
    createInvestment,
    listMyInvestments,
    getInvestmentById,
  };
}

module.exports = {
  createInvestmentsController,
};
